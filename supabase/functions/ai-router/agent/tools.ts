// supabase/functions/ai-router/agent/tools.ts
// JSON Schemas for the agent tools.

export const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for up-to-date information. Returns real search results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "code_interpreter",
      description: "Execute Python code in a sandbox and return stdout/stderr and exit code.",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", enum: ["python"], description: "Programming language." },
          code: { type: "string", description: "Source code to execute." },
        },
        required: ["language", "code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_manager",
      description: "Read, write, or delete files in Supabase Storage.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "write", "delete"], description: "Operation to perform." },
          path: { type: "string", description: "File path in storage (bucket/path)." },
          content: { type: "string", description: "Content to write (required for write)." },
        },
        required: ["action", "path"],
      },
    },
  },
];
