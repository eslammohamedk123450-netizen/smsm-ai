CREATE TABLE IF NOT EXISTS agent_memories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    content TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_execution_logs (
    id SERIAL PRIMARY KEY,
    agent_task_id TEXT,
    tool_name TEXT,
    args JSONB,
    result TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suly_ai_request_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    request_type TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
