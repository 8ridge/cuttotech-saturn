// Email service for sending verification and password reset emails
import { Resend } from 'resend';
import crypto from 'crypto';

// Initialize Resend (free tier: 100 emails/day, 3000/month)
// Only initialize if API key is provided, otherwise functions will handle gracefully
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not set. Email functionality will be disabled.');
}

// Base URL for email links
const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://cutto.tech';

/**
 * Generate a secure random token
 */
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email, name, token) {
  if (!resend) {
    console.warn('⚠️  Email service not configured. RESEND_API_KEY is missing.');
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment variables.');
  }
  
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'CutToTech <noreply@cutto.tech>',
      to: email,
      subject: 'Подтвердите ваш email - CutToTech',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Подтверждение email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Добро пожаловать в CutToTech!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Привет${name ? `, ${name}` : ''}!</p>
            <p>Спасибо за регистрацию в CutToTech. Чтобы начать использовать все возможности сервиса, пожалуйста, подтвердите ваш email адрес.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Подтвердить email
              </a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Эта ссылка действительна в течение 24 часов.
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Если вы не регистрировались в CutToTech, просто проигнорируйте это письмо.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Добро пожаловать в CutToTech!
        
        Привет${name ? `, ${name}` : ''}!
        
        Спасибо за регистрацию. Чтобы начать использовать все возможности сервиса, пожалуйста, подтвердите ваш email адрес.
        
        Перейдите по ссылке: ${verificationUrl}
        
        Эта ссылка действительна в течение 24 часов.
        
        Если вы не регистрировались в CutToTech, просто проигнорируйте это письмо.
      `
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw error;
    }

    console.log('✅ Verification email sent to:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, name, token) {
  if (!resend) {
    console.warn('⚠️  Email service not configured. RESEND_API_KEY is missing.');
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment variables.');
  }
  
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'CutToTech <noreply@cutto.tech>',
      to: email,
      subject: 'Сброс пароля - CutToTech',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Сброс пароля</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Сброс пароля</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Привет${name ? `, ${name}` : ''}!</p>
            <p>Мы получили запрос на сброс пароля для вашего аккаунта CutToTech.</p>
            <p>Нажмите на кнопку ниже, чтобы создать новый пароль:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Сбросить пароль
              </a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
              <a href="${resetUrl}" style="color: #f5576c; word-break: break-all;">${resetUrl}</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Эта ссылка действительна в течение 1 часа.
            </p>
            <p style="font-size: 12px; color: #ff0000; margin-top: 20px; font-weight: bold;">
              ⚠️ Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ваш пароль останется без изменений.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Сброс пароля - CutToTech
        
        Привет${name ? `, ${name}` : ''}!
        
        Мы получили запрос на сброс пароля для вашего аккаунта.
        
        Перейдите по ссылке: ${resetUrl}
        
        Эта ссылка действительна в течение 1 часа.
        
        Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
      `
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw error;
    }

    console.log('✅ Password reset email sent to:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw error;
  }
}

/**
 * Verify email address exists (basic validation)
 * For production, you might want to use a service like Abstract API or EmailListVerify
 */
export async function verifyEmailExists(email) {
  // Basic format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  // Extract domain
  const domain = email.split('@')[1];
  
  // Check for common invalid domains
  const invalidDomains = ['example.com', 'test.com', 'invalid.com'];
  if (invalidDomains.includes(domain.toLowerCase())) {
    return { valid: false, reason: 'Invalid email domain' };
  }

  // For now, we'll do basic validation only
  // In production, you can add DNS MX record check or use a paid service
  return { valid: true };
}


