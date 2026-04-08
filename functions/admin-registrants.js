const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
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

  var params = event.queryStringParameters || {};
  var limitParam = parseInt(params.limit, 10);
  var limit = Number.isNaN(limitParam) || limitParam < 1 ? 500 : Math.min(limitParam, 1000);

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  var query = supabase
    .from('registrations')
    .select(
      'id, created_at, updated_at, status, ' +
      'rider_first, rider_last, rider_grade, rider_dob, rider_category, rider_experience, returning_rider, ' +
      'parent_first, parent_last, parent_email, parent_phone, parent_relationship, ' +
      'emerg_name, emerg_phone, emerg_relationship, ' +
      'medical_notes, bike_type, additional_notes, source'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.category) {
    query = query.eq('rider_category', params.category);
  }

  var result;
  try {
    result = await query;
  } catch (err) {
    console.error('admin-registrants unexpected query exception:', err && err.message ? err.message : err);
    return jsonResponse(500, { ok: false, error: 'Unexpected error while loading registrants.' });
  }

  if (result.error) {
    console.error('admin-registrants query failed:', {
      message: result.error.message,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint
    });
    return jsonResponse(500, { ok: false, error: 'Unable to load registrants right now.' });
  }

  return jsonResponse(200, {
    ok: true,
    registrants: result.data || []
  });
};
