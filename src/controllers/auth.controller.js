const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');

/**
 * Auth Controller
 * Handles all authentication-related business logic
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles auth operations
 * - Dependency Inversion: Uses Supabase abstraction
 */
class AuthController {
  
  /**
   * Sign up with email and password
   * POST /api/auth/signup
   */
  static async signup(req, res, next) {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0]
        }
      }
    });

    if (error) {
      console.error('❌ Supabase auth error:', error);
      throw ApiError.badRequest(error.message);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.user_metadata?.name
      },
      session: data.session
    });
  } catch (error) {
    console.error('💥 Signup error caught:', error.message);
    next(error);
  }
}

  /**
   * Login with email and password
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        throw ApiError.badRequest('Email and password are required');
      }

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw ApiError.unauthorized('Invalid credentials');
      }

      res.status(200).json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata.name
        },
        session: data.session
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  static async getCurrentUser(req, res, next) {
    try {
      // User is already attached by auth middleware
      const user = req.user;

      // Optionally fetch additional profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata.name,
          ...profile
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout (invalidate session)
   * POST /api/auth/logout
   */
  static async logout(req, res, next) {
    try {
      const token = req.token;

      // Sign out from Supabase
      const { error } = await supabase.auth.admin.signOut(token);

      if (error) {
        console.warn('Logout warning:', error);
      }

      res.status(200).json({
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initiate Google OAuth (PKCE flow)
   * GET /api/auth/google
   */
  static async googleAuth(_req, res, next) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.BACKEND_URL}/api/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw ApiError.internal(error.message);

      res.json({ url: data.url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Google OAuth callback (PKCE code exchange)
   * GET /api/auth/callback
   */
  static async googleCallback(req, res, next) {
    try {
      const { code } = req.query;

      if (!code) throw ApiError.badRequest('Missing code parameter');

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) throw ApiError.unauthorized(error.message);

      const params = new URLSearchParams({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: String(data.session.expires_at),
      });

      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${params}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  static async refreshToken(req, res, next) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        throw ApiError.badRequest('Refresh token is required');
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token
      });

      if (error) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      res.status(200).json({
        message: 'Token refreshed successfully',
        session: data.session
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;