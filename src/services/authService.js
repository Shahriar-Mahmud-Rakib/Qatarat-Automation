const axios = require('axios');
const pool = require('../config/db');

class AuthService {
  constructor() {
    this.baseApi = process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  }

  /**
   * Parses various raw phone number formats into standardized countryCode and mobileNumber
   * Supports: +8801772173075, 008801772173075, 8801772173075, 01772173075, 00966500000000, +966500000000, 0500000000
   */
  parsePhone(rawPhone) {
    if (!rawPhone) return { countryCode: '966', mobileNumber: '', fullPhone: '' };

    let cleaned = String(rawPhone).trim();
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    const digits = cleaned.replace(/\D/g, '');

    // Bangladesh numbers
    if (digits.startsWith('880')) {
      const mobile = digits.slice(3).replace(/^0+/, '');
      return { countryCode: '880', mobileNumber: mobile, fullPhone: `+880${mobile}` };
    }
    if (digits.startsWith('01') && digits.length === 11) {
      const mobile = digits.slice(1);
      return { countryCode: '880', mobileNumber: mobile, fullPhone: `+880${mobile}` };
    }

    // Saudi numbers
    if (digits.startsWith('966')) {
      const mobile = digits.slice(3).replace(/^0+/, '');
      return { countryCode: '966', mobileNumber: mobile, fullPhone: `+966${mobile}` };
    }
    if (digits.startsWith('05') && digits.length === 10) {
      const mobile = digits.slice(1);
      return { countryCode: '966', mobileNumber: mobile, fullPhone: `+966${mobile}` };
    }
    if (digits.startsWith('5') && digits.length === 9) {
      return { countryCode: '966', mobileNumber: digits, fullPhone: `+966${digits}` };
    }

    // Common international prefixes (249 Sudan, 853 Macau, 971 UAE, 965 Kuwait, 974 Qatar, 973 Bahrain, 968 Oman, 962 Jordan, etc.)
    const threeDigitCodes = ['249', '853', '971', '965', '974', '973', '968', '962', '961', '963', '964', '967', '970', '972', '212', '213', '216', '218'];
    for (const code of threeDigitCodes) {
      if (digits.startsWith(code) && digits.length > code.length + 5) {
        const mobile = digits.slice(code.length).replace(/^0+/, '');
        return { countryCode: code, mobileNumber: mobile, fullPhone: `+${code}${mobile}` };
      }
    }

    // 2-digit country codes: 62 (Indonesia), 20 (Egypt), 91 (India), 92 (Pakistan), 44 (UK), 90 (Turkey), etc.
    const twoDigitCodes = ['62', '20', '91', '92', '44', '90', '60', '63', '65', '84', '81', '82', '49', '33', '39', '34'];
    for (const code of twoDigitCodes) {
      if (digits.startsWith(code) && digits.length > code.length + 6) {
        const mobile = digits.slice(code.length).replace(/^0+/, '');
        return { countryCode: code, mobileNumber: mobile, fullPhone: `+${code}${mobile}` };
      }
    }

    // 1-digit country codes: 1 (USA / Canada), 7 (Russia/Kazakhstan)
    if ((digits.startsWith('1') || digits.startsWith('7')) && digits.length >= 10 && digits.length <= 12) {
      const code = digits.slice(0, 1);
      const mobile = digits.slice(1).replace(/^0+/, '');
      return { countryCode: code, mobileNumber: mobile, fullPhone: `+${code}${mobile}` };
    }

    // Fallback: Default to 3-digit prefix if long enough, else 966
    return {
      countryCode: digits.length > 9 ? digits.slice(0, 3) : '966',
      mobileNumber: digits.length > 9 ? digits.slice(3).replace(/^0+/, '') : digits.replace(/^0+/, ''),
      fullPhone: `+${digits}`
    };
  }

  /**
   * Creates a fresh guest user session token
   */
  async createGuestSession() {
    const res = await axios.post(`${this.baseApi}/api/v2/Accounts/AccessGuestUser`);
    return {
      token: res.data.accessToken,
      userId: res.data.id,
      userName: res.data.userName,
      role: res.data.role
    };
  }

  /**
   * Dispatches WhatsApp OTP with role support ('user', 'driver', 'admin')
   */
  async sendWhatsAppOtp({ countryCode, mobileNumber, role = 'user', sendNew = true }) {
    const parsed = this.parsePhone(`${countryCode}${mobileNumber}`);
    const cc = parsed.countryCode;
    const mn = parsed.mobileNumber;

    const res = await axios.post(`${this.baseApi}/api/v2/Accounts/SendWhatsAppOtp`, {
      countryCode: cc,
      mobileNumber: mn,
      role: role.toLowerCase(),
      sendNew
    });

    return {
      status: res.status,
      success: res.status === 200 || res.status === 204,
      countryCode: cc,
      mobileNumber: mn,
      role
    };
  }

  /**
   * Verifies OTP and completes login returning JWT tokens
   */
  async verifyOtpAndLogin({ countryCode, mobileNumber, token, sendNew = true }) {
    const parsed = this.parsePhone(`${countryCode}${mobileNumber}`);
    const cc = parsed.countryCode;
    const mn = parsed.mobileNumber;

    const res = await axios.post(`${this.baseApi}/api/v2/Accounts/login`, {
      countryCode: cc,
      mobileNumber: mn,
      token: String(token).trim(),
      sendNew
    });

    return {
      status: res.status,
      userId: res.data.id,
      userName: res.data.userName,
      role: res.data.role,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken
    };
  }

  /**
   * Fast indexed retrieval of OTP from DB via users_phone_split_index
   */
  async getOtpFromDb(countryCode, mobileNumber) {
    const parsed = this.parsePhone(`${countryCode}${mobileNumber}`);
    const cc = parsed.countryCode;
    const mn = parsed.mobileNumber;

    const [rows] = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role, 
        u.country_code, 
        u.mobile_number, 
        u.phone_number, 
        u.otp_code, 
        u.updated_at,
        u.deleted_at
      FROM users u
      WHERE u.country_code = ? 
        AND u.mobile_number = ?
        AND u.deleted_at IS NULL
      ORDER BY u.updated_at DESC
      LIMIT 1
    `, [cc, mn]);

    if (rows.length === 0) return null;

    // Fetch all roles assigned in model_has_roles
    const [roles] = await pool.query(`
      SELECT r.name 
      FROM model_has_roles mhr
      JOIN roles r ON r.id = mhr.role_id
      WHERE mhr.model_id = ?
    `, [rows[0].id]);

    const assignedRoles = roles.map(r => r.name);
    if (rows[0].role && !assignedRoles.includes(rows[0].role)) {
      assignedRoles.push(rows[0].role);
    }

    return {
      userId: rows[0].id,
      name: rows[0].name,
      primaryRole: rows[0].role,
      assignedRoles,
      countryCode: rows[0].country_code,
      mobileNumber: rows[0].mobile_number,
      phoneNumber: rows[0].phone_number,
      otpCode: rows[0].otp_code,
      updatedAt: rows[0].updated_at
    };
  }

  /**
   * Verifies that the phone number is unique across active users in the database
   */
  async verifyPhoneUniqueness(countryCode, mobileNumber) {
    const parsed = this.parsePhone(`${countryCode}${mobileNumber}`);
    const cc = parsed.countryCode;
    const mn = parsed.mobileNumber;

    const [activeUsers] = await pool.query(`
      SELECT id, name, role, country_code, mobile_number, deleted_at
      FROM users
      WHERE country_code = ? AND mobile_number = ? AND deleted_at IS NULL
    `, [cc, mn]);

    const [deletedUsers] = await pool.query(`
      SELECT id, name, role, country_code, mobile_number, deleted_at
      FROM users
      WHERE country_code = ? AND mobile_number = ? AND deleted_at IS NOT NULL
    `, [cc, mn]);

    return {
      isUnique: activeUsers.length <= 1,
      activeCount: activeUsers.length,
      activeUsers,
      mergedOrDeletedCount: deletedUsers.length,
      deletedUsers
    };
  }

  /**
   * Ensures a user has a specific role assigned (User, Driver, Admin)
   */
  async ensureUserRole(userId, roleName) {
    const [roles] = await pool.query('SELECT id, name FROM roles WHERE name = ? LIMIT 1', [roleName]);
    if (roles.length === 0) throw new Error(`Role ${roleName} not found in roles table`);
    const roleId = roles[0].id;

    await pool.query(`
      INSERT INTO model_has_roles (role_id, model_type, model_id)
      VALUES (?, 'App\\\\Models\\\\User', ?)
      ON DUPLICATE KEY UPDATE role_id = role_id
    `, [roleId, userId]);

    if (roleName === 'driver') {
      await pool.query('UPDATE users SET active_driver = 1, updated_at = NOW() WHERE id = ?', [userId]);
    }
  }
}

module.exports = new AuthService();
