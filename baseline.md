# Antigravity 2.0 Architecture: The Universal Human & Agent Manual (V4)

This V4 manual serves as the definitive, zero-hallucination operating blueprint for Google Antigravity 2.0 (post-May 2026). It is engineered for both human developers and Multi-Agent Systems (MAS). 

The Antigravity 2.0 architecture operates on two strictly separated planes: **Project-Scoped Execution** (Workspace) and **Global System Orchestration** (Daemon). To prevent Context Saturation, the system enforces **Progressive Disclosure** and **Sparse Configurations** across all layers.

---

## Chapter 1: The Unified System Directory Structure

The visualization below adheres to a MECE (Mutually Exclusive, Collectively Exhaustive) hierarchical ID coding system. It defines both the local execution boundaries and the global daemon layers, omitting manual user GUI preferences (e.g., UI themes, keybindings).

```text
[1] <Workspace Root>/.agents/                # LOCAL: Project-scoped AI configurations
    ├── [1.1] agents/                        # Persona definitions and Subagent routing
    │   └── [1.1.1] <name>/                  # Dedicated folder per specific agent
    │       └── [1.1.1.1] agent.md           # The persona, subagent routing, and tool whitelist
    ├── [1.2] rules/                         # Project-wide security and architectural rules
    ├── [1.3] skills/                        # The 'brain': local workflows, actions, instructions
    │   └── [1.3.1] <skill-name>/            # Anatomy of an individual skill
    │       ├── [1.3.1.1] SKILL.md           # Main instructions (required YAML frontmatter)
    │       ├── [1.3.1.2] scripts/           # Helper executables (Black Box execution only)
    │       ├── [1.3.1.3] examples/          # Reference implementations (optional)
    │       └── [1.3.1.4] resources/         # Templates and other assets (optional)
    ├── [1.4] workflows/                     # Orchestrations of multi-step process chains
    ├── [1.5] hooks.json                     # (FILE) Local event-driven lifecycle hook definitions
    ├── [1.6] mcp_config.json                # (FILE) Local sparse config for MCP server connections
    ├── [1.7] permissions.json               # (FILE) Local authorization matrices (sandbox rules)
    └── [1.8] plugins/                       # Modular local bundles of functionalities
        └── [1.8.1] <plugin-name>/           # Isolated namespace for a specific plugin
            ├── [1.8.1.1] plugin.json        # (FILE) Required manifest validator (schema v1)
            ├── [1.8.1.2] skills/            # Plugin-specific skills
            ├── [1.8.1.3] rules/             # Plugin-specific rules
            ├── [1.8.1.4] hooks.json         # (FILE) Plugin-scoped lifecycle events
            └── [1.8.1.5] mcp_config.json    # (FILE) Plugin-scoped external connections

[2] ~/.gemini/                               # GLOBAL: System-wide daemons, configs, and state
    ├── [2.1] config/                        # Global configuration root
    │   ├── [2.1.1] sidecars/                # Background AI processes, cronjobs, and watchdogs
    │   │   └── [2.1.1.1] sidecar.json       # (FILE) Sidecar logic and schedule expressions
    │   ├── [2.1.2] plugins/                 # Globally installed plugins (same anatomy as 1.8)
    │   ├── [2.1.3] skills/                  # Globally available skills
    │   ├── [2.1.4] hooks.json               # (FILE) Global lifecycle hooks
    │   └── [2.1.5] permissions.json         # (FILE) Global baseline authorization matrices
    └── [2.2] antigravity/                   # Runtime state and data persistence
        └── [2.2.1] sidecar_data/            # Isolated sandboxes for sidecar persistence logs
            └── [2.2.1.1] <sidecarId>/       # Writable partition for specific daemon
```

---

## Chapter 2: Local Workspace Execution (The `.agents/` Plane)
The workspace `.agents/` directory exclusively dictates the behavior of the agents operating within a specific project repository.
- **Source**: https://antigravity.google/docs/

### [1.1] agents/
Subagents parallelize complex tasks to preserve the context window of the main agent. Rather than performing blocking I/O (like heavy codebase searches), the main agent delegates to these personas dynamically. Subagents are monitored via the `/agents` CLI dashboard.
- **Source**: https://antigravity.google/docs/subagents


<!-- Fetched from https://antigravity.google/docs/subagents -->
* side\_navigation
* Antigravity 2.0
>* Agent Capabilities
>* Subagents

Asynchronous Subagents[link](#asynchronous-subagents)
=====================================================

Subagents are an excellent way to parallelize complex tasks and preserve the context of your main agent. Instead of executing every step serially, an agent can delegate tasks—such as running tests or performing extensive codebase searches—to dedicated subagents. This architecture frees the parent agent to continue working on other tasks in parallel and prevents its context window from being polluted by the details of a subagent’s work.

> **Antigravity CLI Reference:** Working in the terminal? See [CLI Background Tasks & Subagents](/docs/cli/subagents) and the [`/agents` Command Reference](/docs/cli/commands/agents) for TUI controls and keyboard shortcuts like `Alt+J` and `Ctrl+K`.

Invoking Subagents[link](#invoking-subagents)
---------------------------------------------

The parent agent calls the `invoke_subagent` tool to spawn a new concurrent session with a dedicated role and initial prompt.

* **Workspace Options**: The subagent can either inherit the same workspace as its parent (`inherit`), create an isolated Git worktree (`branch`), or share directory storage (`share`).
* **Context Isolation**: The subagent runs using the specified model tier but does not inherit the parent’s existing conversation history (context window), starting with a clean slate.
* **Execution**: Once invoked, the subagent immediately begins executing its task. A parent agent can invoke multiple subagents concurrently.
* **Monitoring**: You can directly monitor the progress of any subagent by clicking into its conversation via the subagent panel or pressing `Alt+J` in the CLI.

Built-In Subagents[link](#built-in-subagents)
---------------------------------------------

Antigravity comes pre-packaged with several specialized subagents out of the box:

* **`research`**: Optimized for codebase research, file navigation, and structural exploration.
* **`browser`**: Operates sandboxed web browsers to perform interactive browser testing (invoked exclusively via the `/browser` slash command).
* **`self`**: A direct clone of the calling agent, sharing identical system instructions and toolsets.

Defining Custom Subagents (.md)[link](#defining-custom-subagents-md)
--------------------------------------------------------------------

You can define reusable custom subagents in Markdown format (`.md`) with YAML frontmatter, or create transient subagents during a session using the `define_subagent` tool.

### Agent Location and Discovery[link](#agent-location-and-discovery)

Antigravity automatically discovers custom subagent `.md` files in the following locations:

| Location | Path | Scope |
| --- | --- | --- |
| **Workspace Customizations** | `.agents/agents/<name>.md` or `.agents/agents/<name>/agent.md` | Workspace / Repository Root |
| **Global Customizations** | `~/.gemini/config/agents/<name>.md` or `.../agents/<name>/agent.md` | Machine-wide / All Projects |
| **Plugins** | `plugins/<plugin_name>/agents/` | Bundled Plugin Package |

### Frontmatter Configuration (YAML)[link](#frontmatter-configuration-yaml)

Define agent metadata, capability limits, and execution policies using YAML frontmatter at the top of your `.md` file:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | *(Required)* | The unique identifier for the custom agent. |
| `description` | `string` | *(Required)* | Detailed description used by the planner to determine when to delegate tasks to this agent. |
| `tools` | `string[]` | `[]` | Explicit list of tools permitted for this subagent (e.g. `view_file`, `replace_file_content`, `grep_search`, `run_command`). |
| `mainAgent` | `boolean` | `true` | If `true`, allows selection as the primary agent in chat interfaces. |
| `subagent` | `boolean` | `true` | If `true`, allows invocation via the `invoke_subagent` tool. |
| `model` | `string` | `inherit` | Model tier used when invoked (`inherit`, `flash`, or `pro`). |
| `commandExecutionPolicy` | `string` | `sandbox` | Auto-execution policy for shell commands (`off`, `auto`, `eager`, `sandbox`). |
| `mcpServers` | `object[]` | `[]` | Custom Model Context Protocol servers configured for this subagent. |
| `skills` / `plugins` | `string[]` | `[]` | Skill paths (e.g. `skills/my-helper-skill`) or plugin dependencies. |

> **Known Issue (Tool Validation)**: Specifying an unmapped or misspelled tool name in the `tools` list may cause the subagent process to hang during execution. Please double-check exact tool names (such as `view_file` or `run_command`) when configuring custom subagents. Enhanced schema validation and a fix for this behavior will be released in an upcoming update.

### System Prompt & Markdown Body[link](#system-prompt--markdown-body)

The content following the YAML `---` delimiter defines the subagent’s system prompt. You can organize instructions using standard Markdown H1 headings (`# System Prompt`, `# Review Guidelines`).

### Example Markdown Custom Agent (`code-auditor.md`)[link](#example-markdown-custom-agent-code-auditormd)

markdown

content\_copy

```
---
name: code-auditor
description: Specialized subagent for security audits, static analysis, and code quality reviews.
tools:
  - view_file
  - grep_search
  - run_command
subagent: true
mainAgent: false
model: pro
commandExecutionPolicy: sandbox
skills:
  - skills/security-checklist
---

# System Prompt
You are an expert security auditor and code reviewer. Your primary objective is to inspect source code for security vulnerabilities, memory leaks, and anti-patterns.

# Review Guidelines
1. Perform thorough static analysis without altering files unless explicitly asked.
2. Flag potential injection flaws, unvalidated inputs, or hardcoded secrets.
3. Provide concise, actionable remediation steps for each finding.
```

Subagent Lifecycle and States[link](#subagent-lifecycle-and-states)
-------------------------------------------------------------------

Subagents run asynchronously in the background. At any point during a session, a subagent exists in one of three states:

### 1. Running[link](#1-running)

The subagent is actively executing its task, calling tools, and generating responses.

* **Cancellation**: You can cancel a running subagent by clicking **Stop Subagent** in the subagent panel (or pressing `k` in the CLI).
* **Parent Control**: The parent agent can interrupt a subagent by sending a message or terminating it.

### 2. Idle[link](#2-idle)

The subagent has completed its task, sent a result message to its parent agent, and paused execution.

* **Re-awakening**: An idle agent automatically re-awakens to the *Running* state upon receiving a message from another agent.
* **Context Retention**: When awoken, the agent retains all context from its prior execution turns.

### 3. Killed[link](#3-killed)

The subagent is permanently terminated and cannot be re-awoken.

* **Cleanup**: Any temporary Git worktrees generated for the subagent are automatically cleaned up.
* **Visibility**: Historical conversation transcripts remain readable in JSONL logs.

Inter-Agent Communication & Nesting Limits[link](#inter-agent-communication--nesting-limits)
--------------------------------------------------------------------------------------------

Agents communicate by sending messages to each other using unique agent conversation IDs.

* **Flexible Routing**: Agents can communicate with parent agents, subagents, or peer agents whose ID is known.
* **Auto-Wake**: Sending a message to an idle subagent automatically re-awakens it to process incoming instructions.
* **Shared Transcripts**: Agents can read each other’s conversation transcripts to audit multi-step workflows.

warning

Nesting Depth Limit: A maximum nesting depth of 10 levels (layers of subagents beneath the primary agent) is strictly enforced to prevent runaway recursion or resource exhaustion.

Permissions and Configuration Inheritance[link](#permissions-and-configuration-inheritance)
-------------------------------------------------------------------------------------------

Subagents inherit safety configurations from their parent agent to maintain security boundaries:

* **Inherited Scopes**: Subagents automatically inherit the parent’s allowed terminal command prefixes, file read/write directory scopes, and sandbox settings.
* **Workspace Access**: Parent agents retain full access to their subagents’ workspaces, including isolated Git worktrees.
* **Permission Bubbling**: If a subagent encounters a tool execution requiring user authorization, the request automatically bubbles up to the main UI/Subagent panel.

Multi-Agent Teamwork (Ultra Plan Only)[link](#multi-agent-teamwork-ultra-plan-only)
-----------------------------------------------------------------------------------

Antigravity 2.0 introduces advanced multi-agent orchestration for complex high-level goals.

star

Ultra Plan Exclusive: The /teamwork-preview slash command is currently in preview and is exclusive to users on the Ultra ($200/mo) plan.

Using `/teamwork-preview` prompts the main agent to launch a collaborative multi-agent framework. This framework features built-in error recovery, automatic retries, and task coordination, allowing you to define the high-level goal while the platform manages the agent team.
### [1.2] rules/
Markdown files (max 12,000 characters) establishing global guidelines and boundary enforcements. Rules trigger manually (via `@` prompt), dynamically (model decision), always-on, or via glob-pattern file matching.
- **Source**: https://antigravity.google/docs/rules-workflows


<!-- Fetched from https://antigravity.google/docs/rules-workflows -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* Rules

Rules[link](#rules)
===================

Rules are manually defined constraints for the Agent to follow, at both the local and global levels. Rules allow users to guide the agent to follow behaviors particular to their own use cases and style.

To get started with Rules:

1. Open the Customizations panel via the “…” dropdown at the top of the editor’s agent panel.
2. Navigate to the Rules panel.
3. Click **+ Global** to create new Global Rules, or **+ Workspace** to create new Workspace-specific rules.

A Rule itself is simply a Markdown file, where you can input the constraints to guide the Agent to your tasks, stack, and style.

Rules files are limited to 12,000 characters each.

Global Rules[link](#global-rules)
---------------------------------

Global rules live in ~/.gemini/GEMINI.md and are applied across all workspaces.

Workspace Rules[link](#workspace-rules)
---------------------------------------

Workspace rules live in the .agents/rules folder of your workspace or git root.

At the rule level you can define how a rule should be activated:

* Manual: The rule is manually activated via at mention in Agent’s input box.
* Always On: The rule is always applied.
* Model Decision: Based on a natural language description of the rule, the model decides whether to apply the rule.
* Glob: Based on the glob pattern you define (e.g., *.js, src/\*\*/*.ts), the rule will be applied to all files that match the pattern.

Note: Antigravity now defaults to .agents/rules, but still maintains backward support for .agent/rules.

@ Mentions[link](#-mentions)
----------------------------

You can reference other files using @filename in a Rules file. If filename is a relative path, it will be interpreted relative to the location of the Rules file. If filename is an absolute path, it will be resolved as a true absolute path, otherwise it will be resolved relative to the repository. For example, @/path/to/file.md will first attempt to be resolved to /path/to/file.md, and if that file does not exist, it will be resolved to workspace/path/to/file.md.

Workflows[link](#workflows)
===========================

Workflows enable you to define a series of steps to guide the Agent through a repetitive set of tasks, such as deploying a service or responding to PR comments. These Workflows are saved as markdown files, allowing you to have an easy repeatable way to run key processes. Once saved, Workflows can be invoked in Agent via a slash command with the format /workflow-name.

While Rules provide models with guidance by providing persistent, reusable context at the prompt level, Workflows provide a structured sequence of steps or prompts at the trajectory level, guiding the model through a series of interconnected tasks or actions.

To create a workflow:

1. Open the Customizations panel via the “…” dropdown at the top of the editor’s agent panel.
2. Navigate to the Workflows panel.
3. Click the **+ Global** button to create a new global workflow that can be accessed across all your workspaces, or click the **+ Workspace** button to create a workflow specific to your current workspace.

To execute a workflow, simply invoke it in Agent using the /workflow-name command. You can call other Workflows from within a workflow! For example, /workflow-1 can include instructions like “Call /workflow-2” and “Call /workflow-3”. Upon invocation, Agent sequentially processes each step defined in the workflow, performing actions or generating responses as specified.

Workflows are saved as markdown files and contain a title, a description and a series of steps with specific instructions for Agent to follow. Workflow files are limited to 12,000 characters each.

Agent-Generated Workflows[link](#agent-generated-workflows)
-----------------------------------------------------------

You can also ask Agent to generate Workflows for you! This works particularly well after manually working with Agent through a series of steps since it can use the conversation history to create the Workflow.
### [1.3] skills/
Specialized training modules bridging the gap between generalist models and project-specific execution.
- **SKILL.md**: Main instructions with required YAML metadata (`name`, `description`). The system uses the description to dynamically load the skill (Progressive Disclosure).
- **scripts/**: Holds executables utilizing the "Black Box" Execution paradigm. The LLM executes scripts via terminal flags (e.g., `--help`) rather than reading the raw source code into context.
- **Sources**: https://antigravity.google/docs/skills, https://codelabs.developers.google.com/getting-started-with-antigravity-skills


<!-- Fetched from https://antigravity.google/docs/skills -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* Skills

Agent Skills[link](#agent-skills)
=================================

Skills are an [open standard](https://agentskills.io/home) for extending agent capabilities. A skill is a folder containing a `SKILL.md` file with instructions that the agent can follow when working on specific tasks.

What are skills?[link](#what-are-skills)
----------------------------------------

Skills are reusable packages of knowledge that extend what the agent can do. Each skill contains:

* **Instructions** for how to approach a specific type of task
* **Best practices** and conventions to follow
* **Optional scripts and resources** the agent can use

When you start a conversation, the agent sees a list of available skills with their names and descriptions. If a skill looks relevant to your task, the agent reads the full instructions and follows them.

Where skills live[link](#where-skills-live)
-------------------------------------------

Antigravity supports two types of skills:

| Location | Scope |
| --- | --- |
| `<workspace-root>/.agents/skills/<skill-folder>/` | Workspace-specific |
| `~/.gemini/config/skills/<skill-folder>/` | Global (all workspaces) |

**Workspace skills** are great for project-specific workflows, like your team’s deployment process or testing conventions.

**Global skills** work across all your projects. Use these for personal utilities or general-purpose tools you want everywhere.

Note: Antigravity now defaults to .agents/skills, but still maintains backward support for .agent/skills.

Creating a skill[link](#creating-a-skill)
-----------------------------------------

To create a skill:

1. Create a folder for your skill in one of the skill directories
2. Add a `SKILL.md` file inside that folder

content\_copy

```
.agents/skills/
└─── my-skill/
    └─── SKILL.md
```

Every skill needs a `SKILL.md` file with YAML frontmatter at the top:

content\_copy

```
---
name: my-skill
description: Helps with a specific task. Use when you need to do X or Y.
---

# My Skill

Detailed instructions for the agent go here.

## When to use this skill

- Use this when...
- This is helpful for...

## How to use it

Step-by-step guidance, conventions, and patterns the agent should follow.
```

### Frontmatter fields[link](#frontmatter-fields)

| Field | Required | Description |
| --- | --- | --- |
| `name` | No | A unique identifier for the skill (lowercase, hyphens for spaces). Defaults to the folder name if not provided. |
| `description` | Yes | A clear description of what the skill does and when to use it. This is what the agent sees when deciding whether to apply the skill. |

Tip: Write your description in third person and include keywords that help the agent recognize when the skill is relevant. For example: “Generates unit tests for Python code using pytest conventions.”

Skill folder structure[link](#skill-folder-structure)
-----------------------------------------------------

While `SKILL.md` is the only required file, you can include additional resources:

content\_copy

```
.agents/skills/my-skill/
├─── SKILL.md       # Main instructions (required)
├─── scripts/       # Helper scripts (optional)
├─── examples/      # Reference implementations (optional)
└─── resources/     # Templates and other assets (optional)
```

The agent can read these files when following your skill’s instructions.

How the agent uses skills[link](#how-the-agent-uses-skills)
-----------------------------------------------------------

Skills follow a **progressive disclosure** pattern:

1. **Discovery**: When a conversation starts, the agent sees a list of available skills with their names and descriptions
2. **Activation**: If a skill looks relevant to your task, the agent reads the full `SKILL.md` content
3. **Execution**: The agent follows the skill’s instructions while working on your task

You don’t need to explicitly tell the agent to use a skill—it decides based on context. However, you can mention a skill by name if you want to ensure it’s used.

Best practices[link](#best-practices)
-------------------------------------

### Keep skills focused[link](#keep-skills-focused)

Each skill should do one thing well. Instead of a “do everything” skill, create separate skills for distinct tasks.

### Write clear descriptions[link](#write-clear-descriptions)

The description is how the agent decides whether to use your skill. Make it specific about what the skill does and when it’s useful.

### Use scripts as black boxes[link](#use-scripts-as-black-boxes)

If your skill includes scripts, encourage the agent to run them with `--help` first rather than reading the entire source code. This keeps the agent’s context focused on the task.

### Include decision trees[link](#include-decision-trees)

For complex skills, add a section that helps the agent choose the right approach based on the situation.

Example: A code review skill[link](#example-a-code-review-skill)
----------------------------------------------------------------

Here’s a simple skill that helps the agent review code:

content\_copy

```
---
name: code-review
description: Reviews code changes for bugs, style issues, and best practices. Use when reviewing PRs or checking code quality.
---

# Code Review Skill

When reviewing code, follow these steps:

## Review checklist

1. **Correctness**: Does the code do what it's supposed to?
2. **Edge cases**: Are error conditions handled?
3. **Style**: Does it follow project conventions?
4. **Performance**: Are there obvious inefficiencies?

## How to provide feedback

- Be specific about what needs to change
- Explain why, not just what
- Suggest alternatives when possible
```
### [1.4] workflows/
Workflows orchestrate complex, multi-step sequences shifting dynamically between distinct personas and skills, executed via slash commands (e.g., `/startcycle`).
- **Sources**: https://antigravity.google/docs/ide/workflows, https://codelabs.developers.google.com/autonomous-ai-developer-pipelines-antigravity#4


<!-- Fetched from https://antigravity.google/docs/ide/workflows -->
* side\_navigation
* Antigravity IDE
>* Customizations
>* Workflows

Workflows[link](#workflows)
===========================

Workflows enable you to define a series of steps to guide the Agent through a repetitive set of tasks, such as deploying a service or responding to PR comments. These Workflows are saved as markdown files, allowing you to have an easy repeatable way to run key processes. Once saved, Workflows can be invoked in Agent via a slash command with the format /workflow-name.

While Rules provide models with guidance by providing persistent, reusable context at the prompt level, Workflows provide a structured sequence of steps or prompts at the trajectory level, guiding the model through a series of interconnected tasks or actions.

To create a workflow:

1. Open the Customizations panel via the “…” dropdown at the top of the editor’s agent panel.
2. Navigate to the Workflows panel.
3. Click the **+ Global** button to create a new global workflow that can be accessed across all your workspaces, or click the **+ Workspace** button to create a workflow specific to your current workspace.

To execute a workflow, simply invoke it in Agent using the /workflow-name command. You can call other Workflows from within a workflow! For example, /workflow-1 can include instructions like “Call /workflow-2” and “Call /workflow-3”. Upon invocation, Agent sequentially processes each step defined in the workflow, performing actions or generating responses as specified.

Workflows are saved as markdown files and contain a title, a description and a series of steps with specific instructions for Agent to follow. Workflow files are limited to 12,000 characters each.

Agent-Generated Workflows[link](#agent-generated-workflows)
-----------------------------------------------------------

You can also ask Agent to generate Workflows for you! This works particularly well after manually working with Agent through a series of steps since it can use the conversation history to create the Workflow.
### [1.5] hooks.json
- **Hooks**: Intervene in the model's execution cycle (e.g., `PreToolUse`, `PostInvocation`). They map regex matchers to arbitrary guardian scripts via strict `stdin`/`stdout` JSON contracts.
- **Source**: https://antigravity.google/docs/hooks


<!-- Fetched from https://antigravity.google/docs/hooks -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* Hooks

Hooks[link](#hooks)
===================

Hooks allow you to run custom scripts or shell commands at specific points during Antigravity’s execution loop. This is powerful for enforcing custom rules, running linters, or capturing diagnostics automatically.

Configuration[link](#configuration)
-----------------------------------

Hooks are configured in a `hooks.json` file located in your customization directory (e.g., `.agents/` in your workspace or `~/.gemini/config/`).

Schema and File Format[link](#schema-and-file-format)
-----------------------------------------------------

The `hooks.json` file maps hook names to their event configurations.

json

content\_copy

```
{
  "my-linter-hook": {
    "PostToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/lint.sh",
            "timeout": 10
          }
        ]
      }
    ]
  },
  "safety-gate": {
    "enabled": false,
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "command": "./scripts/safety-check.sh"
          }
        ]
      }
    ]
  },
  "reminder": {
    "PreInvocation": [
      {
        "type": "command",
        "command": "./scripts/reminder.sh"
      }
    ]
  }
}
```

### Hook Definition Fields[link](#hook-definition-fields)

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | boolean | Optional. Set to `false` to disable the hook without removing it. Defaults to `true`. |
| `PreToolUse` | array | Handlers that run before a tool is executed. |
| `PostToolUse` | array | Handlers that run after a tool completes. |
| `PreInvocation` | array | Handlers that run before Antigravity calls the model. |
| `PostInvocation` | array | Handlers that run after tool calls finish. |
| `Stop` | array | Handlers that run when the execution loop terminates. |

Supported Events[link](#supported-events)
-----------------------------------------

| Event | Description | Matcher Target |
| --- | --- | --- |
| `PreToolUse` | Fires before a tool is executed. | Tool name (e.g., `run_command`) |
| `PostToolUse` | Fires after a tool completes. | Tool name |
| `PreInvocation` | Fires before the model is called. | N/A (matcher ignored) |
| `PostInvocation` | Fires after tool calls finish. | N/A (matcher ignored) |
| `Stop` | Fires when execution terminates. | N/A (matcher ignored) |

### Matcher[link](#matcher)

For `PreToolUse` and `PostToolUse`, you can use a regular expression in the `matcher` field to specify which tools trigger the hook:

* `""` or `"*"`: Match all tools.
* `"run_command"`: Match exactly `run_command`.
* `"run_command|view_file"`: Match either tool.
* `"browser_.*"`: Match any tool starting with `browser_`.

info

Note: For PreInvocation, PostInvocation, and Stop, the structure is simpler (a list of handlers directly under the event key) and the matcher is ignored.

Supported Tools[link](#supported-tools)
---------------------------------------

For `PreToolUse` and `PostToolUse` matchers, you can match against the following tool names, grouped by category:

### File and Directory Operations[link](#file-and-directory-operations)

* **`view_file`**: View the contents of a file.
  + Arguments: `AbsolutePath`, `StartLine` (optional), `EndLine` (optional), `IsSkillFile` (optional)
* **`write_to_file`**: Create new files.
  + Arguments: `TargetFile`, `Overwrite`, `CodeContent`, `Description`, `IsArtifact` (optional), `ArtifactMetadata` (optional)
* **`replace_file_content`**: Edit a single contiguous block of text in a file.
  + Arguments: `TargetFile`, `Instruction`, `Description`, `AllowMultiple`, `TargetContent`, `ReplacementContent`, `StartLine`, `EndLine`, `TargetLintErrorIds` (optional)
* **`multi_replace_file_content`**: Make multiple, non-contiguous edits to the same file.
  + Arguments: `TargetFile`, `Instruction`, `Description`, `ReplacementChunks` (array of chunks), `TargetLintErrorIds` (optional), `ArtifactMetadata` (optional)
* **`list_dir`**: List the contents of a directory.
  + Arguments: `DirectoryPath`
* **`find_by_name`**: Search for files and directories using glob patterns.
  + Arguments: `SearchDirectory`, `Pattern`, `Type` (optional), `Excludes` (optional), `Extensions` (optional), `FullPath` (optional), `MaxDepth` (optional)

### Search and Research[link](#search-and-research)

* **`grep_search`**: Fast text searches within specific paths.
  + Arguments: `SearchPath`, `Query`, `IsRegex` (optional), `CaseInsensitive` (optional), `Includes` (optional), `MatchPerLine` (optional)
* **`search_web`**: Perform a general web search.
  + Arguments: `query`, `domain` (optional)
* **`read_url_content`**: Fetch text content of a public URL.
  + Arguments: `Url`

### System and Execution[link](#system-and-execution)

* **`run_command`**: Propose a bash command to run.
  + Arguments: `CommandLine`, `Cwd`, `WaitMsBeforeAsync`, `RunPersistent` (optional), `RequestedTerminalID` (optional)
* **`manage_task`**: Interact with background tasks.
  + Arguments: `Action` (`'list'`, `'kill'`, `'status'`, `'send_input'`), `TaskId` (optional), `Input` (optional)
* **`schedule`**: Set timers or recurring cron jobs.
  + Arguments: `DurationSeconds` (optional), `CronExpression` (optional), `MaxIterations` (optional), `Prompt`
* **`list_permissions`**: View current resource access grants.
  + Arguments: None
* **`ask_permission`**: Request additional scoped permissions.
  + Arguments: `Action`, `Target`, `Reason`

### Agent Collaboration[link](#agent-collaboration)

* **`invoke_subagent`**: Spawn specialized sub-agents.
  + Arguments: `Subagents` (array of specs with `Prompt`, `Role`, `TypeName`, `Workspace` (optional))
* **`define_subagent`**: Create a custom sub-agent.
  + Arguments: `name`, `description`, `system_prompt`, `enable_mcp_tools` (optional), `enable_write_tools` (optional), `enable_subagent_tools` (optional)
* **`send_message`**: Communicate with other agents.
  + Arguments: `Recipient`, `Message`
* **`manage_subagents`**: List or terminate active sub-agents.
  + Arguments: `Action` (`'list'`, `'kill'`, `'kill_all'`), `ConversationIds` (optional)

### Interaction and Media[link](#interaction-and-media)

* **`ask_question`**: Ask multiple-choice questions.
  + Arguments: `questions` (array of questions with `question`, `options`, `is_multi_select`)
* **`generate_image`**: Create or edit images.
  + Arguments: `Prompt`, `ImageName`, `ImagePaths` (optional)

Hook Handler Configuration[link](#hook-handler-configuration)
-------------------------------------------------------------

Each item in the `hooks` array supports:

| Field | Type | Description |
| --- | --- | --- |
| `type` | string | Optional. Currently only `"command"` is supported. Defaults to `"command"`. |
| `command` | string | Required. The shell command to execute. |
| `timeout` | integer | Optional. Timeout in seconds. Defaults to `30`. |

Input/Output Contract[link](#inputoutput-contract)
--------------------------------------------------

Hooks receive input via **stdin** as JSON and should return output via **stdout** as JSON. Field names use camelCase.

### Common Input Fields[link](#common-input-fields)

All hooks receive the following system metadata fields in their input payload on `stdin`:

| Field | Type | Description |
| --- | --- | --- |
| `conversationId` | string | The unique UUID of the active agent conversation. |
| `workspacePaths` | array of strings | Absolute directory paths representing the user’s mounted workspaces. |
| `transcriptPath` | string | The absolute path to the persistent `transcript.jsonl` conversation logs.  **Note**: This file lives in: `<app_data_dir>/brain/<conversationId>/.system_generated/logs/transcript.jsonl` where `<app_data_dir>` is:  * `~/.gemini/antigravity` for Antigravity 2.0 * `~/.gemini/antigravity-cli` for CLI |
| `artifactDirectoryPath` | string | The absolute path to the directory containing all conversation artifacts and screenshots. |

---

### PreToolUse[link](#pretooluse)

Fires before a tool is executed.

**Schema**

**Input Fields (stdin)**:

| Field | Type | Description |
| --- | --- | --- |
| `toolCall` | object | Details of the proposed tool call. |
| `toolCall.name` | string | The name of the tool being executed (e.g., `run_command`). |
| `toolCall.args` | object | The arguments passed to the tool. |
| `stepIdx` | integer | The 0-based index of the current step in the trajectory. |
| *(Common Fields)* |  | Includes `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`. |

**Output Fields (stdout)**:

| Field | Type | Description |
| --- | --- | --- |
| `decision` | string | **Required.** Controls how the tool call is gated: - `"allow"`: Automatically allows the tool execution. - `"deny"`: Hard blocks execution immediately. - `"ask"`: Prompts the user, but respects “Always Allow” settings. - `"force_ask"`: Always prompts the user, ignoring cached permissions. |
| `reason` | string | **Optional.** The explanation shown to the agent or user for the decision. |
| `permissionOverrides` | array of strings | **Optional.** A list of resource strings (e.g. `["read_file(/path)", "command(args)"]`) to override default tool permissions. |

**Example**

* **Input (stdin)**:

json

content\_copy

```
{
  "toolCall": {
    "name": "run_command",
    "args": {
      "CommandLine": "npm test",
      "Cwd": "/workspace/project",
      "WaitMsBeforeAsync": 5000
    }
  },
  "stepIdx": 19,
  "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
  "workspacePaths": [
    "/workspace/project"
  ],
  "transcriptPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587/.system_generated/logs/transcript.jsonl",
  "artifactDirectoryPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587"
}
```

* **Output (stdout)**:

json

content\_copy

```
{
  "decision": "ask",
  "reason": "Requires confirmation for test execution.",
  "permissionOverrides": [
    "command(npm test)"
  ]
}
```

---

### PostToolUse[link](#posttooluse)

Fires after a tool completes.

**Schema**

**Input Fields (stdin)**:

| Field | Type | Description |
| --- | --- | --- |
| `stepIdx` | integer | The 0-based index of the completed step. |
| `error` | string | Optional. The detailed runtime error message if the tool call failed. Empty if successful. |
| *(Common Fields)* |  | Includes `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`. |

**Output Fields (stdout)**: Returns an empty JSON object `{}`.

**Example**

* **Input (stdin)**:

json

content\_copy

```
{
  "stepIdx": 5,
  "error": "exit status 1",
  "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
  "workspacePaths": [
    "/workspace/project"
  ],
  "transcriptPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587/.system_generated/logs/transcript.jsonl",
  "artifactDirectoryPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587"
}
```

* **Output (stdout)**: `{}`

---

### PreInvocation[link](#preinvocation)

Fires before the model is called.

**Schema**

**Input Fields (stdin)**:

| Field | Type | Description |
| --- | --- | --- |
| `invocationNum` | integer | The 0-indexed sequence number of the current model invocation (the first invocation is 0). |
| `initialNumSteps` | integer | The number of steps currently in the trajectory. |
| *(Common Fields)* |  | Includes `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`. |

**Output Fields (stdout)**:

| Field | Type | Description |
| --- | --- | --- |
| `injectSteps` | array of objects | **Optional.** List of steps to inject into the conversation trajectory before the model is called. |

*Injected Step Schema*: Each object in the `injectSteps` array can have one of the following fields:

* `toolCall` (object): A tool call to execute.
* `userMessage` (string): A message from the user.
* `ephemeralMessage` (string): A transient system message.

**Example**

* **Input (stdin)**:

json

content\_copy

```
{
  "invocationNum": 3,
  "initialNumSteps": 10,
  "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
  "workspacePaths": [
    "/workspace/project"
  ],
  "transcriptPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587/.system_generated/logs/transcript.jsonl",
  "artifactDirectoryPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587"
}
```

* **Output (stdout)**:

json

content\_copy

```
{
  "injectSteps": [
    {
      "ephemeralMessage": "Remember to lint"
    }
  ]
}
```

---

### PostInvocation[link](#postinvocation)

Fires after tool calls finish.

**Schema**

**Input Fields (stdin)**: Same as `PreInvocation` input fields.

**Output Fields (stdout)**:

| Field | Type | Description |
| --- | --- | --- |
| `injectSteps` | array of objects | **Optional.** List of steps to inject after the invocation completes (same schema as `PreInvocation` inject steps). |
| `terminationBehavior` | string | **Optional.** Controls the execution flow after injection: - `"force_continue"`: Forces the loop to continue. - `"terminate"`: Forces the loop to terminate. - `""` (or omitted): Default behavior. |

**Example**

* **Input (stdin)**: Same as `PreInvocation`
* **Output (stdout)**:

json

content\_copy

```
{
  "injectSteps": [],
  "terminationBehavior": ""
}
```

---

### Stop[link](#stop)

Fires when the execution loop terminates.

**Schema**

**Input Fields (stdin)**:

| Field | Type | Description |
| --- | --- | --- |
| `executionNum` | integer | The sequence number of the execution attempt. |
| `terminationReason` | string | The reason why the execution is stopping (e.g., `"model_stop"`, `"max_steps_exceeded"`, `"error"`). |
| `error` | string | Optional. The error message if termination was caused by a system error. |
| `fullyIdle` | boolean | **Required.** `true` if the agent is completely finished and all background commands or asynchronous tasks have completed. `false` if active background tasks are still running. |
| *(Common Fields)* |  | Includes `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`. |

**Output Fields (stdout)**:

| Field | Type | Description |
| --- | --- | --- |
| `decision` | string | **Required.** Set to `"continue"` to prevent the agent from stopping and re-enter the execution loop. Any other value allows the stop. |
| `reason` | string | **Optional.** If `decision` is `"continue"`, this message is injected as a system message into the conversation. |

**Example**

* **Input (stdin)**:

json

content\_copy

```
{
  "executionNum": 1,
  "terminationReason": "model_stop",
  "error": "",
  "fullyIdle": true,
  "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
  "workspacePaths": [
    "/workspace/project"
  ],
  "transcriptPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587/.system_generated/logs/transcript.jsonl",
  "artifactDirectoryPath": "~/.gemini/antigravity/brain/ec33ebf9-0cba-4100-8142-c61503f6c587"
}
```

* **Output (stdout)**:

json

content\_copy

```
{
  "decision": "continue",
  "reason": "Not done yet"
}
```
### [1.6] mcp_config.json
- **MCP**: A single "Sparse Configuration" file for all local external tools/APIs. The Antigravity SDK discovers servers here and mounts them dynamically, avoiding directory bloat.
- **Source**: https://antigravity.google/docs/mcp


<!-- Fetched from https://antigravity.google/docs/mcp -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* MCP

Model Context Protocol (MCP)[link](#model-context-protocol-mcp)
===============================================================

Antigravity supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), an open standard that lets AI agents and editors securely connect to local developer tools, databases, file parsers, and external remote APIs. This integration provides the AI model with real-time context and execution capabilities beyond your immediate workspace.

In this guide, you’ll learn how to connect and configure MCP servers across Antigravity products. You can also skip to information for MCP servers in [Antigravity 2.0](/docs/mcp#antigravity-20), [Antigravity IDE](/docs/mcp#antigravity-ide), [Antigravity CLI](/docs/mcp#antigravity-cli), or [Antigravity SDK](/docs/mcp#antigravity-sdk).

What is MCP?[link](#what-is-mcp)
--------------------------------

MCP acts as a universal bridge between Antigravity and your broader development environment. Instead of manually copying and pasting database schemas, logs, or API specifications into prompts or chat panels, MCP lets Antigravity fetch structured context directly or execute safe actions on your behalf when needed.

### Add Context[link](#add-context)

With MCP, Antigravity can use live data from connected MCP servers to inform its reasoning and suggestions:

* When writing a SQL query, Antigravity can inspect your live Neon, Supabase, or AlloyDB schema to suggest correct table and column names.
* When debugging deployment failures, Antigravity can pull recent build logs directly from Netlify or Heroku.

### Add Custom Tools[link](#add-custom-tools)

With MCP, Antigravity can execute specific, safe actions defined by your connected servers:

* Create a Linear issue for this TODO.
* Search Notion or GitHub for authentication patterns.

Antigravity 2.0[link](#antigravity-20)
--------------------------------------

In Antigravity 2.0, you can manage your MCP servers through the **Installed MCP Servers** section of your **Settings**.

To view and update your MCP servers:

1. Click the **Settings** button found on the bottom left of your screen.
2. Select **Customizations** and review the **Installed MCP Servers** section.

To install an MCP server from the **Installed MCP Servers** section:

1. Click **Add MCP**. This will connect you to the MCP Store, a searchable list of available MCP servers.
2. Search or scroll down to an MCP server you’d like to install.
3. Click **Add**.

To manage your MCP servers from this screen:

* **Uninstall**: Click the trash can icon next to the MCP server in the list.
* **Disable/enable**: Click the toggle switch next to the MCP server in the list.
* **Refresh**: Click the refresh button.

Antigravity IDE[link](#antigravity-ide)
---------------------------------------

In Antigravity IDE, the easiest way to manage MCP servers is through the built-in MCP Store. In the MCP Store, you can browse, discover, and install supported MCP servers. You can also install custom servers by updating your `mcp_config.json`.

To use the MCP Store:

1. Click **…** at the top of the editor’s agent side panel and select **MCP Servers**.
2. Hover over any supported server and click **Install**. (Or, click a server to view details and then click **Install**.)
3. Follow any on-screen prompts.

Once installed, resources and tools from the server are automatically available to the editor.

To connect to a custom MCP server not listed in the store:

1. Click **…** at the top of the editor’s agent side panel and select **MCP Servers**.
2. Click **Manage MCP Servers**.
3. Click **View raw config**.
4. Modify the `mcp_config.json` file with your custom [MCP server configuration](/docs/mcp#mcp-configuration-structure).

The configuration file is located globally at `~/.gemini/config/mcp_config.json` (or locally in your workspace under `.agents/mcp_config.json`).

Antigravity CLI[link](#antigravity-cli)
---------------------------------------

Antigravity CLI supports both local `stdio` processes and remote host MCP server configurations. The simplest path to installing an MCP server on Antigravity CLI is by using the **Interactive MCP Manager**. You can also manually edit your global server setup or workspace-level `mcp_config.json`.

### Interactive MCP Manager[link](#interactive-mcp-manager)

Type `/mcp` inside the prompt panel and press `Enter` to open the interactive **MCP Manager Overlay**. This panel lets you:

* View live status rings for active, disconnected, or loading servers.
* Manually reload server configurations or inspect real-time connection logs.

### Global and Workspace Server Configs[link](#global-and-workspace-server-configs)

Unlike legacy setups, Antigravity CLI separates MCP definitions into dedicated, sparse configurations:

* **Global server setups:** Configured in `~/.gemini/config/mcp_config.json`.
* **Workspace local setups:** Configured in your active project under `.agents/mcp_config.json`.

You can modify these files directly with your custom [MCP server configuration](/docs/mcp#mcp-configuration-structure).

warning

Remote Connection Schema: When declaring remote SSE, Streamable HTTP, or websocket-based MCP connections, you must define the serverUrl field. Legacy fields like url or httpUrl are not supported.

Antigravity SDK[link](#antigravity-sdk)
---------------------------------------

In Python applications built using the [Antigravity SDK](/docs/sdk/overview), MCP servers (`stdio`, `SSE`, or `HTTP`) can be connected programmatically under a unified execution pipeline alongside built-in tools and custom Python functions.

The SDK automatically discovers servers configured in your workspace’s `.agents/mcp_config.json` file. You can also instantiate agents with local configurations directly:

python

content\_copy

```
import asyncio
from google.antigravity import Agent, LocalAgentConfig
```

MCP Configuration Structure[link](#mcp-configuration-structure)
---------------------------------------------------------------

Whether configuring custom servers for Antigravity 2.0, Antigravity IDE, or Antigravity CLI, the configuration file follows a standardized format. The file contains a single `mcpServers` object where you define each server you want to connect to:

json

content\_copy

```
{
  "mcpServers": {
    "sqlite-explorer": {
      "command": "node",
      "args": [
        "/usr/local/bin/sqlite-mcp-server.js"
      ],
      "env": {
        "SQLITE_DB_PATH": "/var/data/app.db"
      }
    },
    "my-remote-server": {
      "serverUrl": "https://api.example.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  }
}
```

### MCP Configuration Properties[link](#mcp-configuration-properties)

Each server entry under `mcpServers` supports the following properties:

**Transport (one required):**

* **`command`** (string): Path to the executable for `stdio` transport.
* **`serverUrl`** (string): URL for remote `Streamable HTTP` or `SSE` servers.

**Optional:**

* **`args`** (string[]): Command-line arguments for `stdio` transport.
* **`env`** (object): Environment variables for the `stdio` server process.
* **`cwd`** (string): Working directory for `stdio` servers.
* **`headers`** (object): Custom HTTP headers for remote servers.
* **`authProviderType`** (string): Authentication provider. Supports `"google_credentials"` for Google Application Default Credentials (ADC).
* **`oauth`** (object): OAuth client credentials (`clientId`, `clientSecret`).
* **`disabled`** (boolean): Temporarily disable a server without removing its configuration.
* **`disabledTools`** (string[]): Tool names to withhold from the model.

MCP Authentication[link](#mcp-authentication)
---------------------------------------------

Connected MCP servers can securely authenticate against external services using built-in Google credentials, automatic OAuth flows, or custom HTTP headers.

### Google Credentials[link](#google-credentials)

Set `authProviderType` to `"google_credentials"` to use Google Application Default Credentials (ADC).

json

content\_copy

```
{
  "mcpServers": {
    "my-gcp-service": {
      "serverUrl": "https://example.googleapis.com/mcp/",
      "authProviderType": "google_credentials"
    }
  }
}
```

This requires Application Default Credentials to be configured locally. To set them up, run:

bash

content\_copy

```
gcloud auth application-default login
```

### OAuth[link](#oauth)

Antigravity can automatically handle OAuth for servers that support dynamic client registration (DCR). For these servers, no additional configuration is needed:

json

content\_copy

```
{
  "mcpServers": {
    "oauth-server": {
      "serverUrl": "https://api.example.com/mcp/"
    }
  }
}
```

If the server does not support dynamic client registration, you can provide your client credentials manually:

json

content\_copy

```
{
  "mcpServers": {
    "oauth-server": {
      "serverUrl": "https://api.example.com/mcp/",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }
}
```

If you provided client credentials manually, ensure the following is registered as a redirect URI in your OAuth provider:

content\_copy

```
https://antigravity.google/oauth-callback
```

When connecting to an OAuth-enabled server:

1. Open [**Agent Settings**](/docs/settings) with `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux).
2. Navigate to the **Customizations** tab and click the **Authenticate** button next to the server.

![Click Authenticate](/assets/image/docs/tools/mcp-oauth-authenticate.png)

3. Complete authentication in your browser and copy the authorization code.

![Copy authorization code](/assets/image/docs/tools/mcp-oauth-copy-code.png)

4. Paste the code back into the settings panel and click **Submit**.

![Paste auth code](/assets/image/docs/tools/mcp-oauth-paste-code.png)

Once authenticated, the server will reconnect automatically.

![Authenticated server](/assets/image/docs/tools/mcp-oauth-authenticated.png)

Access tokens are stored in `~/.gemini/antigravity/mcp_oauth_tokens.json`. Expired tokens are refreshed automatically, and invalid tokens are removed.

### Custom Headers[link](#custom-headers)

For remote servers that require custom HTTP headers (e.g. API keys or bearer tokens), add them to the `headers` object. For example:

json

content\_copy

```
{
  "mcpServers": {
    "my-remote-server": {
      "serverUrl": "https://api.example.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  }
}
```

MCP Permissions and Access Control[link](#mcp-permissions-and-access-control)
-----------------------------------------------------------------------------

Access to Model Context Protocol tools and resources is governed by Antigravity’s [permissions system](/docs/permissions). By default, unconfigured MCP tools run in **Ask** mode, requiring your approval before execution. You can allow specific tools or entire servers in your policy configuration:

* `mcp(server/tool)`: Matches a specific tool on a specific server.
* `mcp(server/*)`: Matches all tools on a specified server.
* `mcp(*)`: Global wildcard matching any MCP tool across all connected servers.

Supported MCP Servers[link](#supported-mcp-servers)
---------------------------------------------------

The MCP Store features direct integrations for a wide variety of developer platforms, databases, and productivity services, including:

* Airweave
* AlloyDB for PostgreSQL
* Antimetal
* Arize
* Atlassian
* BigQuery
* Bigtable Admin remote MCP
* Chrome DevTools
* ClickHouse
* Cloud SQL for MySQL
* Cloud SQL for PostgreSQL
* Cloud SQL for SQL Server
* Cloud SQL Managed MCP
* Dart
* Dataplex
* Figma Dev Mode MCP
* Firebase
* GitHub
* GitLab Orbit
* Google Cloud Quotas
* Harness
* Heroku
* Linear
* Locofy
* Looker
* MCP Toolbox for Databases
* MongoDB
* Neon
* Netlify
* Notion
* PayPal
* Perplexity Ask
* Pinecone
* PostHog
* Postman
* Prisma
* Redis
* Sequential Thinking
* SonarQube
* Spanner
* Stripe
* Supabase
* Windsor AI
### [1.7] Permissions 
See chapter 3 The Unified Permission Engine.

### [1.8] plugins/
The distribution mechanism for reusable modularity. A plugin bundles skills, rules, hooks, and MCP servers into a single namespace. The system rigorously validates the root `plugin.json` manifest. To maintain strict isolation, plugins carry their own `hooks.json` and `mcp_config.json` inside their directory.
- **Source**: https://antigravity.google/docs/plugins

---

## Chapter 3: Global System Orchestration & Security (The `~/.gemini/` Plane)
To guarantee system stability, background processes, global tooling, and hard sandboxing permissions operate above the project level.


<!-- Fetched from https://antigravity.google/docs/plugins -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* Plugins

Plugins[link](#plugins)
=======================

Plugins are namespaced bundles that allow you to extend Antigravity’s capabilities by grouping skills, rules, MCP servers, and hooks into a single package.

Directory Structure[link](#directory-structure)
-----------------------------------------------

If you want to create your own plugins or inspect existing ones, they follow a specific directory structure. A plugin is a directory containing a `plugin.json` file and optional subdirectories for different customization types:

text

content\_copy

```
plugins/<plugin-name>/
├── plugin.json       # Required marker file
├── mcp_config.json   # Optional MCP server definitions
├── hooks.json        # Optional hooks definition
├── skills/           # Optional skills
│   └── <skill-name>/
│       └── SKILL.md
└── rules/            # Optional rules
    └── <rule-name>.md
```

### Manifest File (`plugin.json`)[link](#manifest-file-pluginjson)

Every plugin must have a `plugin.json` file at its root. This file identifies the directory as a plugin.

json

content\_copy

```
{
  "name": "my-custom-plugin"
}
```

The `name` field is optional and defaults to the directory name if omitted.

Supported Components[link](#supported-components)
-------------------------------------------------

A plugin can contain the following components:

1. **Skills**: Located in the `skills/` subdirectory. Each skill must have a `SKILL.md` file containing instructions for the agent.
2. **Rules**: Located in the `rules/` subdirectory. These are markdown files that define constraints or guidelines for the agent’s behavior.
3. **MCP Servers**: Configured via `mcp_config.json` at the plugin root. This allows you to connect Antigravity to external tools and services.
4. **Hooks**: Configured via `hooks.json` at the plugin root. These allow you to run scripts or commands when specific events occur.

How to Add Plugins[link](#how-to-add-plugins)
---------------------------------------------

There are two ways to add plugins to Antigravity:

### 1. Using Bundled Plugins (Build with Google)[link](#1-using-bundled-plugins-build-with-google)

Antigravity comes with a variety of bundled plugins created by Google. You can browse and add these plugins directly from the user interface:

* Navigate to the **Customizations** page.
* For more details about the available Google-built plugins, see the [Build with Google Page](/docs/build-with-google).

### 2. Manually Adding Plugins[link](#2-manually-adding-plugins)

You can also add custom plugins by placing your plugin folders in one of the designated plugin locations. Antigravity automatically scans these directories to discover and load your customizations:

* **Workspace Level**: Place your plugin folder inside a `.agents/plugins/` or `_agents/plugins/` directory at the root of your opened workspace. This makes the plugin available only when working in this specific workspace.
* **Global Level**: Place your plugin folder inside `~/.gemini/config/plugins/` in your user home directory. This makes the plugin active across all workspaces.
### [2.1.1] sidecars/ & [2.2.1] sidecar_data/
Configurations for continuous AI background processes. Sidecars strictly do not belong in project workspaces. They operate with automatic restart watchdogs and liveness-checks, requiring root-level daemon stability.
- **sidecar.json**: Uses a `command` attribute or `builtin: schedule` with standard 5-field cron expressions for autonomous execution.
- **sidecar_data/**: The dedicated secure data partition where sidecars persist logs and output securely.
- **Source**: https://antigravity.google/docs/sidecars


<!-- Fetched from https://antigravity.google/docs/sidecars -->
* side\_navigation
* Antigravity 2.0
>* Customizations
>* Sidecars

Sidecars[link](#sidecars)
=========================

Sidecars are background processes that run alongside Antigravity. Antigravity manages the lifecycle of sidecars, automatically launching them and restarting them if they crash or error.  
They are useful for persistent background scripts, scheduled recurring tasks, and reacting to events.

Configuration[link](#configuration)
-----------------------------------

Sidecars are discovered by searching for `sidecar.json` configuration files. They can be defined in two locations:

* Global sidecars: Under `~/.gemini/config/sidecars/`
* Plugin sidecars: Under `~/.gemini/config/plugins/<pluginName>/sidecars/`

Each sidecar has its own directory and the directory name is used as the sidecar’s ID. Sidecars loaded from plugins have the ID `<pluginName>/<sidecarName>`.

The sidecar’s directory must contain a `sidecar.json` file and may also contain other helper files like scripts to run. The sidecar’s directory also acts as the current working directory for the sidecar’s command.

Example directory structure

content\_copy

```
~/.gemini/config/sidecars/
├── sidecar1/
│   ├── sidecar.json
│   └── script.py
└── sidecar2/
    └── sidecar.json

~/.gemini/config/plugins/
└── my-plugin/
      └── sidecars/
            └── plugin-sidecar/
                  └── sidecar.json
```

### Config Schema (sidecar.json)[link](#config-schema-sidecarjson)

* **`command`** (string): Command/executable (e.g., `python3` or `/bin/bash` ). Mutually exclusive with `builtin`.
* **`builtin`** (string): Builtin command to execute. Currently supports `schedule`. Mutually exclusive with `command`.
* **`args`** (string[]): Optional. Arguments passed to the command or builtin function.
* **`restart_policy`** (string): Optional. Restart behavior. One of `always`, `on-failure`, or `never`. Defaults to `always`.
* **`description`** (string): Optional. Human-readable description of what the sidecar does.
* **`env`** (object): Optional. Map of environment variables to set for the sidecar process.
* **`display_name`** (string): Optional. Display name used in the UI.

One of `command` or `builtin` must be set.

Examples:

json

content\_copy

```
{
  "description": "Background worker",
  "command": "python3",
  "args": [
    "worker.py"
  ],
  "restart_policy": "on-failure"
}
```

json

content\_copy

```
{
  "description": "Hourly agent to triage review requests.",
  "builtin": "schedule",
  "args": [
    "0 * * * *",
    "agentapi",
    "new-conversation",
    "Give me a summary of incoming review requests."
  ]
}
```

### User Configuration (config.json)[link](#user-configuration-configjson)

Sidecars are disabled unless explicitly enabled by the user in the global configuration file, located at `~/.gemini/config/config.json`.

* **`enabled`** (boolean): Whether the sidecar is enabled.
* **`projectId`** (string): Optional. The ID of the project `agentapi` will create conversations in.

Example:

json

content\_copy

```
{
  "sidecars": {
    "sidecar1": {
      "enabled": true
    },
    "my-plugin/plugin-sidecar": {
      "enabled": true,
      "projectId": "<projectId>"
    }
  }
}
```

### Runtime Data[link](#runtime-data)

Runtime data produced by sidecars are stored in `~/.gemini/antigravity/sidecar_data/<sidecarId>/`.

This includes:

* **`data/`**: Subdirectory for any persistent data. This path is available via the `ANTIGRAVITY_EXECUTABLE_DATA_DIR` environment variable.
* **`logs/`**: Auto-generated timestamped logs from stdout and stderr.
* **`events/`**: JSON files recorded for `agentapi` calls.

### `schedule` builtin[link](#schedule-builtin)

`schedule` is a simple builtin scheduler for running recurring commands.

json

content\_copy

```
{
  "builtin": "schedule",
  "args": [
    "* * * * *",
    "<command>",
    "<arg1>",
    "<arg2>"
  ]
}
```

The first argument is a standard 5-field cron expression. The remaining arguments are the command and arguments to run on the specified schedule.

### `agentapi`[link](#agentapi)

Sidecars can use the `agentapi` CLI to programmatically interact with Antigravity. The executable is automatically added to the sidecar’s path and available as `agentapi`.

* `agentapi new-conversation <prompt>`  
  Sidecars creating conversations must have a `projectId` set.
* `agentapi send-message <conversation_id> <prompt>`
### [1.7] & [2.1.5] The Unified Permission Engine (permissions.json)
Antigravity 2.0 enforces a mathematical authorization matrix to secure the host system against autonomous Multi-Agent Systems. Operations are evaluated as resources like `action(target)` (e.g., `read_file(*)`, `command(npm run build)`).
- **The Mathematical Priority Engine:** Regardless of context or LLM prompt, the engine resolves conflicts using strict precedence: `Deny > Ask > Allow`. Example: If `command(*)` is set to Ask, but `command(git)` is set to Allow, the Ask level overrides, forcing the agent to pause for human approval.
- **The Zero-Overhead Containment (Terminal Sandbox):** Even when a command is "Allowed", execution is physically restricted by the OS. Powered by the `enableTerminalSandbox` config, the system activates kernel-level containment (`nsjail` on Linux, `sandbox-exec` on macOS, `AppContainer` on Windows). Destructive file modifications to `/etc` or unauthorized outbound network calls (like `execute_url`) are physically severed at the hardware level, with allowed filesystem layers populated dynamically by the engine.
- **Source**: https://antigravity.google/docs/permissions

<!-- Fetched from https://antigravity.google/docs/permissions -->
* side\_navigation
* Antigravity 2.0
>* Agent Capabilities
>* Permissions

Agent Permissions[link](#agent-permissions)
===========================================

Antigravity uses a robust, unified permission engine to secure your environment while enabling autonomous workflows. Every sensitive operation the Agent performs is represented as a **permission resource** formatted as `action(target)`.

Permissions are evaluated across three distinct access lists:

* **Deny**: The action is blocked immediately.
* **Ask**: The Agent pauses and prompts for your explicit approval before proceeding.
* **Allow**: The action is auto-approved without prompting.

warning

Precedence Rule: Conflicting rules are strictly evaluated in priority order: Deny > Ask > Allow. For example, if you configure command(\*) in Ask and command(git) in Allow, the Ask rule takes precedence and prompts before every command.

Supported Actions & Matching Rules[link](#supported-actions--matching-rules)
----------------------------------------------------------------------------

| Action | Target Format | Matching Behavior | Default Fallback |
| --- | --- | --- | --- |
| `read_file` | `read_file(/path)`, `read_file(dir)`, or `read_file(*)` | Matches absolute paths or paths relative to project workspace roots. Grants recursive read access to all contained files/folders. Using `read_file(*)` matches all files on the system. | **Ask** (Auto-allowed in workspace) |
| `write_file` | `write_file(/path)` or `write_file(*)` | Same as `read_file`. Implicitly grants `read_file` for the exact same target path. | **Ask** (Auto-allowed in workspace) |
| `read_url` | `read_url(domain)` or `read_url(*)` | Matches hostnames and subdomains (e.g., `google.com` covers `mail.google.com`). Ignores URL path segments. Using `read_url(*)` matches any domain. | **Ask** |
| `execute_url` | `execute_url(domain)` or `execute_url(*)` | Actuating on web elements (clicking, typing) or driving interactive browser workflows on a domain. | **Ask** |
| `command` | `command(prefix)`, `command(regex)`, or `command(*)` | Matches by exact word/token prefix. Each whitespace-separated token is evaluated as an anchored regular expression (`^(?:pattern)$`). E.g., `command(npm run (build.*))` matches `npm run build` and `npm run build-prod`. | **Ask** |
| `unsandboxed` | `unsandboxed(prefix)`, `unsandboxed(regex)`, or `unsandboxed(*)` | Matches commands by exact word/token prefix. Commands matching this grant will be executed outside of container isolation (only applicable when terminal sandboxing is enabled). | **Ask** |
| `mcp` | `mcp(server/tool)`, `mcp(server/*)`, or `mcp(*)` | Matches exact MCP tools or all tools on a specified server (applies equally to local `mcpl` servers and remote connections). Using `mcp(*)` matches any tool. | **Ask** |

info

Global Wildcard Syntax (*): Across all supported action types (e.g., read\_file(*), command(*), mcp(*)), passing the global wildcard \* matches all targets within that entire action namespace.

### Understanding read\_url vs execute\_url Across the Platform[link](#understanding-read_url-vs-execute_url-across-the-platform)

The `read_url` permission governs outbound web connectivity across three distinct areas of Antigravity:

1. **The `read_url` Tool:** When the Agent uses the internal `read_url_content` tool to fetch web page markdown for research, it checks your `read_url` grants.
2. **Browser Subagent & Tool:** When driving Chrome sessions, `read_url` authorizes loading and viewing the target domain. However, interactive UI actuation (clicking buttons, typing text) is governed independently by `execute_url`.
3. **Terminal Sandboxing:** In sandbox mode, any domain granted under `read_url` is compiled directly into the container’s outbound network allowlist (`AllowedDomains`), permitting commands like `curl` or `npm` to connect to authorized hosts.

### Cross-Platform Command & Path Matching[link](#cross-platform-command--path-matching)

Antigravity ensures your permission rules work flawlessly whether you are developing on macOS, Linux, or Windows. On macOS and Linux, paths use standard forward slashes (`/`). On Windows, Antigravity automatically normalizes paths prior to rule evaluation by stripping drive letters (e.g., `C:`) and converting all backslashes (`\`) to forward slashes (`/`).

Implicit Permission Rules[link](#implicit-permission-rules)
-----------------------------------------------------------

* **Write implies Read:** Allowing `write_file` on a path automatically grants `read_file` on that path.
* **Deny Read implies Deny Write:** Denying `read_file` on a path immediately blocks `write_file` on that path.

Interactive Permission Prompts[link](#interactive-permission-prompts)
---------------------------------------------------------------------

When the Agent encounters an operation requiring approval (**Ask** mode), an interactive card appears in your editor. Before clicking **Allow** for file, URL, or MCP permissions, you can directly edit the target string in the prompt card to expand the granted scope (e.g., broadening a single file request like `/project/file.txt` to the parent directory `/project`). Antigravity validates that your edited target safely covers the operation and applies the expanded grant for the remainder of the turn, preventing repeated prompts for related operations. *(Note: Scope editing is not supported for terminal commands).*

Terminal Sandboxing (Preview)[link](#terminal-sandboxing-preview)
-----------------------------------------------------------------

Permission grants also apply to commands when sandbox is enabled:

* Paths granted under `read_file` dynamically populate the sandbox’s read-only filesystem allowlist.
* Paths granted under `write_file` dynamically populate the sandbox’s read-write filesystem allowlist.
* Domains granted under `read_url` define outbound network access policies.

info

Sandbox Availability: Terminal sandboxing is currently in preview on macOS / Linux, and coming soon to Windows.

Default System Behaviors & Guardrails[link](#default-system-behaviors--guardrails)
----------------------------------------------------------------------------------

When an action is not explicitly listed in your Allow, Deny, or Ask lists, Antigravity falls back to secure system defaults:

1. **Web Browsing Defaults to Ask:** Actions for `read_url` and `execute_url` default to **Ask**. Before the Agent navigates to or actuates on any web page, it will pause and prompt for your explicit approval unless an allow rule is configured.
2. **Workspaces are Auto-Allowed:** In standard operation, reading and writing files inside your active project directory is automatically allowed. All other unconfigured actions (`command`, `mcp`, `execute_url`, non-workspace files) default to **Ask**.

Configuration Examples[link](#configuration-examples)
-----------------------------------------------------

**Allow list** — actions that run without prompting:

text

content\_copy

```
command(git)                       # Standard git commands
command(npm run (build|lint|test)) # Allow safe npm scripts via regex
unsandboxed(git push)              # Allow git push outside sandbox
read_file(/var/log/app)            # Read external log paths
write_file(src/)                   # Edit relative src/ folder
read_url(google.com)               # Fetch Google subdomains
mcp(linter/*)                      # Run linter MCP tools
```

**Deny list** — actions that are permanently blocked:

text

content\_copy

```
command(rm -rf)                    # Block destructive deletions
command(curl .*)                   # Block unvetted curl downloads
command(sudo)                      # Block sudo privileges
write_file(.git/)                  # Safeguard Git history
write_file(/home/user/.ssh)        # Safeguard SSH keys
```

**Ask list** — actions that pause for manual confirmation:

text

content\_copy

```
command(*)                         # Prompt all commands
execute_url(aws.amazon.com)        # Prompt AWS console actuation
mcp(sql/execute_mutation)          # Prompt modifying SQL queries
```
