-- ============================================
-- Migration 002: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------
-- profiles: users can read own profile, admins read all
-- -------------------------------------------
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- -------------------------------------------
-- ai_models: all authenticated can read active models
-- -------------------------------------------
CREATE POLICY ai_models_select_all ON ai_models
  FOR SELECT USING (true);

CREATE POLICY ai_models_admin_all ON ai_models
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- -------------------------------------------
-- api_keys: only service role (Edge Functions) can access
-- -------------------------------------------
CREATE POLICY api_keys_service_role_only ON api_keys
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- -------------------------------------------
-- conversations: users own their conversations
-- -------------------------------------------
CREATE POLICY conversations_select_own ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY conversations_insert_own ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY conversations_update_own ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY conversations_delete_own ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------
-- messages: users can read messages in their conversations
-- -------------------------------------------
CREATE POLICY messages_select_own ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_own ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- -------------------------------------------
-- credit_transactions: users read own transactions
-- -------------------------------------------
CREATE POLICY credit_transactions_select_own ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY credit_transactions_insert_service ON credit_transactions
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- -------------------------------------------
-- model_health_logs: admins read all, service role inserts
-- -------------------------------------------
CREATE POLICY model_health_logs_select_admin ON model_health_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY model_health_logs_insert_service ON model_health_logs
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- -------------------------------------------
-- admin_audit_logs: admins read all, service role inserts
-- -------------------------------------------
CREATE POLICY admin_audit_logs_select_admin ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY admin_audit_logs_insert_service ON admin_audit_logs
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );
