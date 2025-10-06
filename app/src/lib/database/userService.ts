import { db, CACHE_KEYS, CACHE_TTL } from './connection';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  wallet_address: string;
  email?: string;
  username?: string;
  profile_image_url?: string;
  kyc_status: 'not_verified' | 'pending' | 'verified' | 'rejected';
  kyc_data?: any;
  preferences: any;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  is_active: boolean;
  referral_code?: string;
  referred_by?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  refresh_token?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export class UserService {
  // Create new user
  async createUser(userData: {
    wallet_address: string;
    email?: string;
    username?: string;
    profile_image_url?: string;
    referral_code?: string;
    referred_by?: string;
  }): Promise<User> {
    const userId = uuidv4();
    const referralCode = this.generateReferralCode();

    const query = `
      INSERT INTO users (
        id, wallet_address, email, username, profile_image_url, 
        referral_code, referred_by, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      userId,
      userData.wallet_address,
      userData.email,
      userData.username,
      userData.profile_image_url,
      referralCode,
      userData.referred_by,
      JSON.stringify({}),
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    // Cache user profile
    await db.setCache(CACHE_KEYS.USER_PROFILE(userId), user, CACHE_TTL.USER_PROFILE);

    return user;
  }

  // Get user by wallet address
  async getUserByWallet(walletAddress: string): Promise<User | null> {
    // Try cache first
    const cacheKey = `user:wallet:${walletAddress}`;
    let user = await db.getCache(cacheKey);

    if (!user) {
      const query = 'SELECT * FROM users WHERE wallet_address = $1 AND is_active = true';
      const result = await db.query(query, [walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }

      user = result.rows[0];
      
      // Cache for future requests
      await db.setCache(cacheKey, user, CACHE_TTL.USER_PROFILE);
      await db.setCache(CACHE_KEYS.USER_PROFILE(user.id), user, CACHE_TTL.USER_PROFILE);
    }

    return user;
  }

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    // Try cache first
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
    let user = await db.getCache(cacheKey);

    if (!user) {
      const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      user = result.rows[0];
      
      // Cache for future requests
      await db.setCache(cacheKey, user, CACHE_TTL.USER_PROFILE);
    }

    return user;
  }

  // Update user profile
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const allowedFields = ['email', 'username', 'profile_image_url', 'preferences', 'kyc_status', 'kyc_data'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [userId, ...updateFields.map(field => updates[field as keyof User])];

    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // Update cache
    await db.setCache(CACHE_KEYS.USER_PROFILE(userId), user, CACHE_TTL.USER_PROFILE);
    await db.deleteCache(`user:wallet:${user.wallet_address}`);

    return user;
  }

  // Create user session
  async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<UserSession> {
    const sessionId = uuidv4();
    const sessionToken = this.generateSessionToken();
    const refreshToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const query = `
      INSERT INTO user_sessions (
        id, user_id, session_token, refresh_token, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [sessionId, userId, sessionToken, refreshToken, ipAddress, userAgent, expiresAt];

    const result = await db.query(query, values);
    const session = result.rows[0];

    // Store session in Redis
    await db.setSession(sessionToken, {
      sessionId,
      userId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      expiresAt,
    }, 86400); // 24 hours

    // Update user last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);

    return session;
  }

  // Validate session
  async validateSession(sessionToken: string): Promise<{ valid: boolean; userId?: string; session?: any }> {
    // Check Redis first for performance
    const sessionData = await db.getSession(sessionToken);
    
    if (!sessionData) {
      return { valid: false };
    }

    // Check if session is expired
    if (new Date() > new Date(sessionData.expiresAt)) {
      await this.deleteSession(sessionToken);
      return { valid: false };
    }

    return {
      valid: true,
      userId: sessionData.userId,
      session: sessionData,
    };
  }

  // Delete session (logout)
  async deleteSession(sessionToken: string): Promise<void> {
    // Remove from Redis
    await db.deleteSession(sessionToken);

    // Mark as inactive in database
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE session_token = $1',
      [sessionToken]
    );
  }

  // Generate referral code
  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  }

  // Generate session token
  private generateSessionToken(): string {
    return uuidv4() + '-' + Date.now().toString(36);
  }

  // Get user statistics
  async getUserStats(userId: string): Promise<{
    total_trades: number;
    total_volume_usd: number;
    total_fees_paid: number;
    active_positions: number;
    portfolio_value: number;
  }> {
    const cacheKey = `user:stats:${userId}`;
    let stats = await db.getCache(cacheKey);

    if (!stats) {
      const query = `
        SELECT 
          COUNT(t.id) as total_trades,
          COALESCE(SUM(t.quote_amount), 0) as total_volume_usd,
          COALESCE(SUM(t.fee_amount), 0) as total_fees_paid,
          (SELECT COUNT(*) FROM liquidity_positions lp WHERE lp.user_id = $1 AND lp.status = 'active') as active_positions,
          (SELECT COALESCE(total_value_usd, 0) FROM portfolio_snapshots ps WHERE ps.user_id = $1 ORDER BY created_at DESC LIMIT 1) as portfolio_value
        FROM trades t
        WHERE t.user_id = $1 AND t.status = 'confirmed'
      `;

      const result = await db.query(query, [userId]);
      stats = result.rows[0];

      // Cache for 5 minutes
      await db.setCache(cacheKey, stats, 300);
    }

    return stats;
  }

  // Get user referrals
  async getUserReferrals(userId: string): Promise<{
    referrals: User[];
    total_count: number;
    total_volume: number;
  }> {
    const query = `
      SELECT 
        u.*,
        COALESCE(SUM(t.quote_amount), 0) as referral_volume
      FROM users u
      LEFT JOIN trades t ON u.id = t.user_id AND t.status = 'confirmed'
      WHERE u.referred_by = $1 AND u.is_active = true
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const result = await db.query(query, [userId]);
    const referrals = result.rows;

    const totalVolume = referrals.reduce((sum, ref) => sum + parseFloat(ref.referral_volume || 0), 0);

    return {
      referrals,
      total_count: referrals.length,
      total_volume: totalVolume,
    };
  }
}
