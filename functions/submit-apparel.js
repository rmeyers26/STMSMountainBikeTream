const { createClient } = require('@supabase/supabase-js');

const TABLE_NAME = process.env.SUPABASE_APPAREL_TABLE || 'apparel_orders';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function toInt(value) {
  var parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Missing request body.';
  }

  var contact = payload.contact || {};
  if (!String(contact.firstName || '').trim()) return 'First name is required.';
  if (!String(contact.lastName || '').trim()) return 'Last name is required.';
  if (!String(contact.email || '').trim()) return 'Email is required.';

  var riders = Array.isArray(payload.riders) ? payload.riders : [];
  if (!riders.length) return 'At least one rider is required.';

  for (var i = 0; i < riders.length; i++) {
    var rider = riders[i] || {};
    var riderName = String(rider.name || '').trim() || 'Rider ' + (i + 1);

    if (!String(rider.name || '').trim()) {
      return 'Each rider must have a name.';
    }
    if (!String(rider.role || '').trim()) {
      return riderName + ': ordering role is required.';
    }
    if (!String(rider.team || '').trim()) {
      return riderName + ': team selection is required.';
    }

    var topQty = toInt(rider.topQty);
    var bibQty = toInt(rider.bibQty);
    var tshirtQty = toInt(rider.tshirtQty);

    if (rider.role === 'rider') {
      if (topQty <= 0) {
        return riderName + ': riders must order at least one top (jersey).';
      }
      if (bibQty <= 0) {
        return riderName + ': riders must order at least one bib.';
      }
    }

    if (topQty > 0 && !String(rider.topSize || '').trim()) {
      return riderName + ': top size is required when top quantity is greater than zero.';
    }
    if (bibQty > 0 && !String(rider.bibSize || '').trim()) {
      return riderName + ': bib size is required when bib quantity is greater than zero.';
    }
    if (tshirtQty > 0 && !String(rider.tshirtSize || '').trim()) {
      return riderName + ': t-shirt size is required when t-shirt quantity is greater than zero.';
    }
  }

  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: 'Supabase environment variables are not configured.' });
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
  }

  var validationError = validatePayload(payload);
  if (validationError) {
    return jsonResponse(400, { ok: false, error: validationError });
  }

  var contact = payload.contact || {};
  var riders = Array.isArray(payload.riders) ? payload.riders : [];

  var row = {
    contact_email: String(contact.email || '').trim(),
    contact_name: (String(contact.firstName || '').trim() + ' ' + String(contact.lastName || '').trim()).trim(),
    rider_count: riders.length,
    source: 'apparel-form',
    order_payload: payload
  };

  var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  var result = await supabase.from(TABLE_NAME).insert(row).select('id').single();

  if (result.error) {
    console.error('submit-apparel insert failed:', result.error.message);
    return jsonResponse(500, { ok: false, error: 'Unable to save order right now. Please try again.' });
  }

  return jsonResponse(200, {
    ok: true,
    orderId: result.data ? result.data.id : null
  });
};
