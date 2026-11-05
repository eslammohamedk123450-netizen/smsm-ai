-- ============================================
-- Migration 003: RPC Functions
-- ============================================

CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id UUID,
  p_total_tokens INTEGER,
  p_cost INTEGER,
  p_source TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  SELECT credit_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF v_current_balance < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', p_cost
    );
  END IF;

  v_new_balance := v_current_balance - p_cost;

  UPDATE profiles
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, source, reference_id, created_at)
  VALUES (p_user_id, -p_cost, 'deduct', p_source, p_reference_id, now())
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'deducted', p_cost,
    'tokens', p_total_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  SELECT credit_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE profiles
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, source, reference_id, created_at)
  VALUES (p_user_id, p_amount, 'add', p_source, p_reference_id, now())
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'added', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION suspend_model(
  p_model_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  UPDATE ai_models
  SET status = 'suspended', updated_at = now()
  WHERE id = p_model_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, created_at)
  VALUES (v_admin_id, 'suspend_model', 'ai_model', p_model_id,
          jsonb_build_object('reason', p_reason), now());

  RETURN jsonb_build_object('success', true, 'model_id', p_model_id, 'status', 'suspended');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reactivate_model(
  p_model_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  UPDATE ai_models
  SET status = 'active', updated_at = now()
  WHERE id = p_model_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, created_at)
  VALUES (v_admin_id, 'reactivate_model', 'ai_model', p_model_id,
          jsonb_build_object('reason', 'Manual reactivation by admin'), now());

  RETURN jsonb_build_object('success', true, 'model_id', p_model_id, 'status', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT credit_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_model_health_failure(
  p_model_id UUID,
  p_provider TEXT,
  p_model_name TEXT,
  p_failure_type TEXT,
  p_failure_reason TEXT,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_failure_count INTEGER;
  v_should_suspend BOOLEAN := FALSE;
BEGIN
  INSERT INTO model_health_logs (model_id, provider, model_name, failure_type, failure_reason, response_time_ms, status_code, recorded_at)
  VALUES (p_model_id, p_provider, p_model_name, p_failure_type, p_failure_reason, p_response_time_ms, p_status_code, now());

  SELECT COUNT(*) INTO v_failure_count
  FROM model_health_logs
  WHERE model_id = p_model_id
    AND recorded_at >= now() - interval '15 minutes';

  IF v_failure_count >= 3 THEN
    UPDATE ai_models
    SET status = 'suspended', updated_at = now()
    WHERE id = p_model_id AND status = 'active';

    v_should_suspend := TRUE;

    INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, created_at)
    VALUES (auth.uid(), 'auto_suspend_model', 'ai_model', p_model_id,
            jsonb_build_object(
              'reason', p_failure_reason,
              'failure_count', v_failure_count,
              'window_minutes', 15
            ), now());
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'failure_count', v_failure_count,
    'auto_suspended', v_should_suspend,
    'threshold', 3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
