"""
LangGraph implementation of an agent that uses ExplorerToolBox tools.

This provides an ExplorerAgent class to manage LangGraph agent instances
that use ExplorerToolBox tools for repository exploration and tasks.
"""

import asyncio
import os
import sys
import time
import json
from typing import Any, Dict, List

from dotenv import load_dotenv

# Fix imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent_classes import ExplorerToolBox

# Add current directory to sys.path for agent_consts
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from agent_consts import STRUCTURED_EXPLORER_PROMPT, AgentState
from langgraph_utils import (
    create_agent_graph,
    create_run_config,
    print_run_end,
    print_run_start,
)
from llm_consts import ChatAnthropic
from thought_logger import AgentLogger
from supported_models import find_supported_model_given_model_name, SUPPORTED_MODELS


class ExplorerAgent:
    """A LangGraph agent that uses ExplorerToolBox tools for repository exploration and analysis."""

    def __init__(self):
        """Initialize the ExplorerAgent with default values."""
        self.graph = None
        self.toolbox = None
        self.logger = None
        self.llm_client = None
        self.live_logging = False
        self.run_id = None
        self.subtask_id = None

    async def setup(
        self,
        owner: str,
        repos: list[str],
        installation_id: int,
        model_provider: str,
        model_name: str,
        branch: str = None,
        llm_client=None,
        live_logging=False,
        run_id=None,
        running_locally=False,
        subtask_id=None,
        fake_calls_path: str = None
    ):
        """
        Set up the agent with necessary components.

        Args:
            owner (str): GitHub repository owner
            repos (list[str]): List of repositories
            installation_id (int): GitHub installation ID
            branch (str): Repository branch (optional)
            model_name (str): LLM model name
            llm_client: LLM client to use. If None, creates new one.
            live_logging (bool): Whether to print live logs
            run_id (str): Run ID for logging
            running_locally (bool): Whether running locally
            subtask_id (str): Subtask ID for logging
            fake_calls_path (str): Path to JSON file containing fake LLM responses for testing

        Returns:
            ExplorerAgent: The configured agent instance
        """
        # Set instance variables
        self.live_logging = live_logging
        self.run_id = run_id or str(int(time.time()))
        self.running_locally = running_locally
        self.subtask_id = subtask_id
        self.model_provider = model_provider
        self.model_name = model_name

        # Setup clients and dependencies
        await self._setup_clients()
        await self._setup_toolbox(owner, repos, installation_id, branch)
        self._setup_llm_and_logger(llm_client, model_name, fake_calls_path)
        await self._setup_graph(repos)

        return self

    async def _setup_clients(self):
        """Placeholder for now."""

    async def _setup_toolbox(self, owner, repos, installation_id, branch):
        """Initialize and authenticate the toolbox."""
        self.toolbox = ExplorerToolBox(
            owner, repos, installation_id, branch, running_locally=self.running_locally
        )
        await self.toolbox.authenticate()

    def _setup_llm_and_logger(self, llm_client, model_name, fake_calls_path=None):
        """Setup LLM client and logger."""
        self.llm_client = llm_client or ChatAnthropic(model=model_name)
        self.logger = AgentLogger(
            run_id=self.run_id,
        )

        # find the correct chat client
        chat_info = SUPPORTED_MODELS[self.model_provider]
        if not self.model_name in chat_info['models']:
            print('-'*50)
            print(f'[DEBUG] Model {self.model_name} not found in {self.model_provider} models. May not be supported!')
            print('-'*50)

        chat_client = chat_info['chat_class']
        self.llm_client = chat_client(model=model_name)

        # Load fake responses if path is provided
        if fake_calls_path and os.path.exists(fake_calls_path):
            try:
                with open(fake_calls_path, "r") as f:
                    fake_calls = json.load(f)
                for fake_call in fake_calls.get("fake_calls", []):
                    self.llm_client.add_fake_response(fake_call)
                if self.live_logging:
                    print(f"Loaded fake responses from {fake_calls_path}")
            except Exception as e:
                raise RuntimeError(f"Failed to load fake responses from {fake_calls_path}. This is a fatal error as test responses are required: {str(e)}")

    async def _setup_graph(self, repos):
        """Create and configure the agent graph."""
        tools = self.toolbox.get_all_tools()
        tool_names = [tool["name"] for tool in tools]
        tool_descriptions = [f"{tool['name']}: {tool['description']}" for tool in tools]

        prompt = STRUCTURED_EXPLORER_PROMPT.partial(
            tools="\n".join(tool_descriptions),
            tool_names=", ".join(tool_names),
            available_repos=", ".join(repos),
        )

        self.graph = create_agent_graph(
            tools=tools,
            prompt=prompt,
            llm_client=self.llm_client,
            logger=self.logger,
            toolbox=self.toolbox,
            state_type=AgentState,
        )

    async def run(self, user_input: str, run_id: str = None) -> Dict[str, Any]:
        """
        Run the agent with the given user input.

        Args:
            user_input (str): The user's query
            run_id (str): Unique identifier for the run

        Returns:
            Dict: The final state after completion

        Raises:
            ValueError: If the agent has not been set up
        """
        if self.graph is None:
            raise ValueError("Agent not set up. Call setup() first.")

        # Update run_id if provided
        if run_id:
            self.run_id = run_id
            if self.logger:
                self.logger.run_id = run_id

        initial_state = AgentState(user_input=user_input)

        # print_run_start(
        #     f"EXPLORER AGENT RUN WITH INPUT: {user_input}", self.live_logging
        # )

        config = create_run_config(self.run_id)
        result = await self.graph.ainvoke(initial_state, config=config)

        # print_run_end(self.live_logging)

        return result


# Example usage
async def main(owner: str = "cairn-dev", repos: List[str] = ["frontend", "backend"]):
    """Example usage of ExplorerAgent"""

    load_dotenv()

    run_id = f"FULLSTACK_TEST"

    user_query = "immediately generate a fake backned and frontend task. i am testing something."

    # Create and setup the agent
    agent = ExplorerAgent()
    await agent.setup(
        owner=owner,
        repos=repos,
        installation_id=65848345,
        # branch="main",  # Optional, set to None to use default branch
        live_logging=True,
        run_id=run_id,
        running_locally=True,
    )

    result = await agent.run(user_query)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
