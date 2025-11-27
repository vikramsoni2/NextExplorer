// Returns: { set: boolean, value: any, message?: string }
function getTrustProxySetting() {
  const trustProxy = process.env.TRUST_PROXY?.trim().toLowerCase();
  const publicUrl = process.env.PUBLIC_URL?.trim();

  if (trustProxy !== undefined) {
    let value;
    let message;

    if (trustProxy === 'true') {
      value = 'loopback,uniquelocal';
      message = "trust proxy: mapped 'true' to 'loopback,uniquelocal' (safer)";
    } else if (trustProxy === 'false') {
      value = false;
      message = 'trust proxy disabled via TRUST_PROXY=false';
    } else if (/^\d+$/.test(trustProxy)) {
      value = Number(trustProxy);
      message = `trust proxy set to '${value}'`;
    } else {
      value = trustProxy;
      message = `trust proxy set to '${value}'`;
    }

    return { set: true, value, message };
  }

  // Default only when PUBLIC_URL is provided
  if (publicUrl) {
    return {
      set: true,
      value: 'loopback,uniquelocal',
      message: "trust proxy defaulted to 'loopback,uniquelocal' (PUBLIC_URL set)",
    };
  }

  return { set: false, value: false };
}

module.exports = { getTrustProxySetting };