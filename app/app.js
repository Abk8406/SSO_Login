const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const axios = require('axios');

const app = express();

// Environment variables with fallbacks
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const TENANT_ID = process.env.TENANT_ID ;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/auth/callback';

// Azure AD Configuration
const config = {
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    tenantID: TENANT_ID,
    callbackURL: CALLBACK_URL,
    resource: 'https://graph.microsoft.com',
    authorizationURL: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,
    tokenURL: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
};

// Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Trust proxy in production
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
    try {
        done(null, user);
    } catch (error) {
        console.error('Serialization error:', error);
        done(error);
    }
});

passport.deserializeUser((user, done) => {
    try {
        done(null, user);
    } catch (error) {
        console.error('Deserialization error:', error);
        done(error);
    }
});

// Azure AD OAuth2 Strategy
passport.use(new OAuth2Strategy({
    authorizationURL: config.authorizationURL,
    tokenURL: config.tokenURL,
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    scope: ['openid', 'profile', 'email', 'offline_access']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Attempting to fetch user info from Microsoft Graph API');
        // Get user info from Microsoft Graph API
        const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const user = {
            id: response.data.id,
            displayName: response.data.displayName,
            email: response.data.mail || response.data.userPrincipalName,
            accessToken,
            refreshToken
        };

        console.log('Successfully authenticated user:', user.email);
        return done(null, user);
    } catch (error) {
        console.error('Authentication error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return done(error);
    }
}));

// Routes
app.get('/', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            console.log('User authenticated, redirecting to dashboard');
            res.redirect('/dashboard');
        } else {
            console.log('User not authenticated, redirecting to login page');
            res.redirect('/login-page');
        }
    } catch (error) {
        console.error('Root route error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Login route
app.get('/login', (req, res, next) => {
    console.log('Login route accessed');
    try {
        if (req.isAuthenticated()) {
            console.log('User already authenticated, redirecting to dashboard');
            return res.redirect('/dashboard');
        }
        
        console.log('Initiating OAuth2 authentication');
        passport.authenticate('oauth2', {
            scope: ['openid', 'profile', 'email', 'offline_access'],
            prompt: 'select_account'  // Force account selection
        })(req, res, next);
    } catch (error) {
        console.error('Login route error:', error);
        res.status(500).send('Authentication failed');
    }
});

// Add a simple login page route
app.get('/login-page', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Login - NuNxtWav-Dev SSO</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .login-container { max-width: 400px; margin: 50px auto; text-align: center; }
                    .login-button { 
                        background-color: #0078d4; 
                        color: white; 
                        padding: 10px 20px; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        font-size: 16px; 
                    }
                    .login-button:hover { background-color: #106ebe; }
                </style>
            </head>
            <body>
                <div class="login-container">
                    <h1>Welcome to NuNxtWav-Dev SSO</h1>
                    <p>Please sign in with your organization account</p>
                    <a href="/login">
                        <button class="login-button">Sign in with Microsoft</button>
                    </a>
                </div>
            </body>
        </html>
    `);
});

// Callback route
app.get('/auth/callback', (req, res, next) => {
    passport.authenticate('oauth2', {
        successRedirect: '/dashboard',
        failureRedirect: '/login',
        failureMessage: true
    })(req, res, next);
});

// Add error handling middleware for authentication errors
app.use((err, req, res, next) => {
    console.error('Authentication Error:', {
        message: err.message,
        status: err.status || 500,
        details: err.response?.data || err
    });

    // Handle specific Azure AD errors
    if (err.message && err.message.includes('does not exist in tenant')) {
        return res.status(403).json({
            error: {
                message: 'Access Denied: Your account is not registered in this organization. Please contact your administrator for access.',
                details: 'You need to be added as an external user in the tenant first.',
                code: 'TENANT_ACCESS_DENIED'
            }
        });
    }

    // Handle other authentication errors
    if (err.name === 'AuthenticationError') {
        return res.status(401).json({
            error: {
                message: 'Authentication failed',
                details: err.message,
                code: 'AUTH_FAILED'
            }
        });
    }

    // Handle other errors
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Something went wrong',
            status: err.status || 500
        }
    });
});

// Add a route to handle authentication errors
app.get('/auth-error', (req, res) => {
    const error = req.query.error || 'Unknown error';
    const errorDescription = req.query.error_description || 'No description available';
    
    res.status(400).json({
        error: {
            message: error,
            details: errorDescription,
            timestamp: new Date().toISOString()
        }
    });
});

// Dashboard route (protected)
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    try {
        res.send(`Welcome ${req.user.displayName}!`);
    } catch (error) {
        console.error('Dashboard route error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    try {
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).send('Error during logout');
            }
            res.redirect('/');
        });
    } catch (error) {
        console.error('Logout route error:', error);
        res.status(500).send('Error during logout');
    }
});

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    try {
        if (req.isAuthenticated()) {
            return next();
        }
        console.log('Authentication required - redirecting to login');
        res.redirect('/login');
    } catch (error) {
        console.error('Authentication check error:', error);
        res.status(500).send('Authentication check failed');
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500
    });
    
    // Send appropriate error response
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Something went wrong',
            status: err.status || 500
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Azure AD Configuration:', {
        clientID: config.clientID,
        tenantID: config.tenantID,
        callbackURL: config.callbackURL
    });
});
