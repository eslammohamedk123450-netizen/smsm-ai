// supabase/functions/ai-router/agent/tools.ts
// JSON Schemas for the agent tools.

export const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for up-to-date information.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_manager",
      description: "Manage GitHub repos, files, and pull requests.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create_repo", "commit_file", "create_pull_request"], description: "Action to perform." },
          repo: { type: "string", description: "Repository name (owner/repo)." },
          path: { type: "string", description: "File path for commit_file." },
          content: { type: "string", description: "File content for commit_file." },
          title: { type: "string", description: "PR title." },
          body: { type: "string", description: "PR body." },
          head: { type: "string", description: "Source branch." },
          base: { type: "string", description: "Target branch." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gmail_actions",
      description: "Gmail operations: send, list unread, reply.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["send_email", "list_unread", "reply"], description: "Action to perform." },
          to: { type: "string", description: "Recipient email." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Email body." },
          message_id: { type: "string", description: "Message id for reply." },
          reply_body: { type: "string", description: "Reply body." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "whatsapp_manager",
      description: "WhatsApp operations: send template, get history.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["send_template", "get_history"], description: "Action to perform." },
          to: { type: "string", description: "Recipient phone number." },
          template_name: { type: "string", description: "Template name." },
          params: { type: "array", items: { type: "string" }, description: "Template params." },
          phone: { type: "string", description: "Phone for history." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_manager",
      description: "Calendar operations: schedule meeting, list events.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["schedule_meeting", "list_events"], description: "Action to perform." },
          summary: { type: "string", description: "Meeting title." },
          start: { type: "string", description: "Start datetime ISO." },
          end: { type: "string", description: "End datetime ISO." },
          attendees: { type: "array", items: { type: "string" }, description: "Attendee emails." },
          time_min: { type: "string", description: "Range start." },
          time_max: { type: "string", description: "Range end." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "financial_analyzer",
      description: "Financial data: stock price, crypto analysis.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get_stock_price", "analyze_crypto"], description: "Action to perform." },
          symbol: { type: "string", description: "Stock/crypto symbol." },
          coin: { type: "string", description: "Crypto coin id." },
        },
        required: ["action"],
      },
    },
  },
  // ---- Global infrastructure tools: shared by every feature ----
  {
    type: "function",
    function: {
      name: "memory_search",
      description: "Search the user's saved task memories across every feature of the app.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for." },
          feature_key: { type: "string", description: "Optional feature namespace filter." },
          limit: { type: "integer", description: "Maximum memories to return (1-10)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "media_search",
      description: "Find files the user uploaded earlier (documents, lectures, images) and return their links.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "File name or keyword." },
          feature_key: { type: "string", description: "Optional feature namespace filter." },
          limit: { type: "integer", description: "Maximum results (1-20)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "document_read",
      description: "Read the text content of a stored file by its https link.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Public https link of the stored file." },
          max_chars: { type: "integer", description: "Maximum characters to return (default 8000)." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "feature_resources",
      description: "List the resource links of an activated feature (for example the study content library).",
      parameters: {
        type: "object",
        properties: {
          feature_key: { type: "string", description: "Feature namespace, for example hims." },
        },
        required: ["feature_key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_memory_save",
      description: "Save a durable note about the user's task so future agents can recall it.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title." },
          content: { type: "string", description: "What should be remembered." },
          feature_key: { type: "string", description: "Optional feature namespace." },
          task_kind: { type: "string", description: "Optional task category." },
        },
        required: ["content"],
      },
    },
  },
];
