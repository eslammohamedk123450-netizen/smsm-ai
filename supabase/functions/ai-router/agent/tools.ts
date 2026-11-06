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
];
