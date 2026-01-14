const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const notificationService = require('../services/notification.service');
const { getDeviceInfo, getLocationFromIP } = require('../../src/utilis/deviceDetector');

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 12);
        
        const user = await User.create({
            email,
            password: hashedPassword,
            profile: {
                name: name
            },
            verificationToken
        });
        console.log("USER SAVED 👉", user._id);

        const token = generateToken(user._id);

        // ✅ Send welcome notification (fire and forget - don't block response)
        notificationService.createNotification(user._id, {
            type: 'system',
            title: '🎉 Welcome to Tadib!',
            body: 'Start building better habits and earning rewards today!',
            actions: [
                { actionType: 'view', label: 'Get Started' }
            ]
        }).catch(err => {
            console.error('Welcome notification error:', err.message);
        });

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.profile.name
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.accountStatus !== 'active') {
            return res.status(403).json({ error: 'Account suspended or deleted' });
        }

        user.lastActive = new Date();
        await user.save();

        const token = generateToken(user._id);

        // ✅ Send sign-in notification (fire and forget - don't block response)
        (async () => {
            try {
                const deviceInfo = getDeviceInfo(req);
                const location = await getLocationFromIP(deviceInfo.ipAddress);
                
                await notificationService.sendSignInNotification(user._id, {
                    ...deviceInfo,
                    location
                });
            } catch (notifError) {
                console.error('Sign-in notification error:', notifError.message);
            }
        })();

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.profile.name,
                gamification: user.gamification,
                subscription: user.subscription
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }

    
};

exports.socialLogin = async (req, res) => {
    try {
        const { provider, providerId, email, name, accessToken } = req.body;

        let user = await User.findOne({
            'socialAuth.provider': provider,
            'socialAuth.providerId': providerId
        });

        if (!user) {
            user = await User.findOne({ email });

            if (user) {
                user.socialAuth = { provider, providerId, accessToken };
            } else {
                user = await User.create({
                    email,
                    profile: {
                        name: name
                    },
                    socialAuth: { provider, providerId, accessToken },
                    isEmailVerified: true
                });
            }
            await user.save();
        }

        const token = generateToken(user._id);

        // ✅ Send sign-in notification for social login (fire and forget)
        (async () => {
            try {
                const deviceInfo = getDeviceInfo(req);
                const location = await getLocationFromIP(deviceInfo.ipAddress);
                
                await notificationService.sendSignInNotification(user._id, {
                    ...deviceInfo,
                    location,
                    loginMethod: `${provider} OAuth`
                });
            } catch (notifError) {
                console.error('Social login notification error:', notifError.message);
            }
        })();

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.profile.name
            }
        });
    } catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        user.isEmailVerified = true;
        user.verificationToken = undefined;
        await user.save();

        // ✅ Send email verified notification (fire and forget)
        notificationService.createNotification(user._id, {
            type: 'system',
            title: '✅ Email Verified!',
            body: 'Your email has been successfully verified. You now have full access to all features.',
            actions: [
                { actionType: 'view', label: 'Explore Features' }
            ]
        }).catch(err => {
            console.error('Email verification notification error:', err.message);
        });

        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        // ✅ Send password reset notification (fire and forget)
        notificationService.createNotification(user._id, {
            type: 'security_alert',
            title: '🔐 Password Reset Requested',
            body: 'A password reset was requested for your account. If this wasn\'t you, please secure your account immediately.',
            actions: [
                { actionType: 'view', label: 'View Details' }
            ]
        }).catch(err => {
            console.error('Password reset notification error:', err.message);
        });

        res.json({ success: true, message: 'Reset link sent to email', resetToken });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // ✅ Send password changed notification (fire and forget)
        notificationService.createNotification(user._id, {
            type: 'security_alert',
            title: '✅ Password Changed Successfully',
            body: 'Your password has been changed. If you didn\'t make this change, please contact support immediately.',
            actions: [
                { actionType: 'view', label: 'Review Activity' }
            ]
        }).catch(err => {
            console.error('Password changed notification error:', err.message);
        });

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { token } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const newToken = generateToken(decoded.userId);

        res.json({ success: true, token: newToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

exports.logout = async (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
};

exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = verificationToken;
        await user.save();

        res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: error.message });
    }
};