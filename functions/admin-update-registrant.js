const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

var VALID_STATUSES = ['pending', 'approved', 'active', 'inactive', 'waitlist'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'PATCH') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: 'Admin report is not configured.',
      hint: 'Set Supabase and admin token environment variables in Netlify and redeploy.'
    });
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return jsonResponse(401, { ok: false, error: verification.error });
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { ok: false, error: 'Invalid request body.' });
  }

  var id = body.id;
  var status = body.status;

  if (!id || typeof id !== 'string' || !id.trim()) {
    return jsonResponse(400, { ok: false, error: 'Missing or invalid id.' });
  }

  if (!status || VALID_STATUSES.indexOf(status) === -1) {
    return jsonResponse(400, {
      ok: false,
      error: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', ') + '.'
    });
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  var result;
  try {
    result = await supabase
      .from('registrations')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', id.trim());
  } catch (err) {
    console.error('admin-update-registrant unexpected error:', err && err.message ? err.message : err);
    return jsonResponse(500, { ok: false, error: 'Unexpected error while updating registrant.' });
  }

  if (result.error) {
    console.error('admin-update-registrant update failed:', {
      message: result.error.message,
      code: result.error.code
    });
    return jsonResponse(500, { ok: false, error: 'Unable to update registrant right now.' });
  }

  return jsonResponse(200, { ok: true });
};
