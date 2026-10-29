import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const user = process.env.EMAIL_USER || 'vaishnavi.appservice@gmail.com';
    const pass = process.env.EMAIL_PASS || 'hlbcnqqiyrhjkmsv';

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
};

/**
 * Sends a 6-digit OTP email for account verification
 */
export const sendOtpEmail = async ({ toEmail, otpCode, userName }) => {
  try {
    const mailer = getTransporter();
    const fromAddress = `"Meiora AI" <${process.env.EMAIL_USER || 'vaishnavi.appservice@gmail.com'}>`;

    const mailOptions = {
      from: fromAddress,
      to: toEmail,
      subject: `${otpCode} is your Meiora AI Verification Code`,
      text: `Hello ${userName || 'User'},\n\nYour Meiora AI verification code is: ${otpCode}\n\nThis code is valid for 10 minutes. Do not share this code with anyone.\n\nBest regards,\nMeiora AI Team`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background: #070B20; color: #E8EAFF; border-radius: 16px; overflow: hidden; border: 1px solid rgba(108, 92, 231, 0.3);">
          <div style="background: linear-gradient(135deg, #6C5CE7 0%, #00D4FF 100%); padding: 28px 24px; text-align: center;">
            <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; letter-spacing: 0.5px;">Meiora AI</h1>
            <p style="margin: 6px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">Account Email Verification</p>
          </div>
          
          <div style="padding: 32px 28px; text-align: center;">
            <p style="font-size: 16px; color: #E8EAFF; margin: 0 0 16px;">Hello <strong>${userName || 'there'}</strong>,</p>
            <p style="font-size: 14px; color: #9BA3C8; line-height: 1.5; margin: 0 0 24px;">
              Thank you for registering on <strong>Meiora AI</strong>. Please use the verification code below to confirm your account and complete registration.
            </p>
            
            <div style="background: #0F1535; border: 1px dashed #6C5CE7; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 0 auto 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #00D4FF; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
            </div>
            
            <p style="font-size: 12px; color: #FFA502; margin: 0 0 16px;">⏱️ This code is valid for <strong>10 minutes</strong>.</p>
            <p style="font-size: 12px; color: #5C6490; margin: 0;">
              If you didn't create an account on Meiora AI, please disregard this email.
            </p>
          </div>
          
          <div style="background: #090D28; padding: 16px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <p style="margin: 0; font-size: 11px; color: #5C6490;">
              © ${new Date().getFullYear()} Meiora AI. Grounded Fact Checking & Brand Sentiment System.
            </p>
          </div>
        </div>
      `,
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`[Email Service] OTP email sent to ${toEmail} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send OTP to ${toEmail}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
};

/**
 * Sends an Analysis Summary Report email upon analysis completion
 */
export const sendAnalysisReportEmail = async ({ toEmail, userName, analysis }) => {
  try {
    const mailer = getTransporter();
    const fromAddress = `"Meiora AI Alerts" <${process.env.EMAIL_USER || 'vaishnavi.appservice@gmail.com'}>`;
    const title = analysis.title || 'Fact-Check Analysis Report';
    const classification = analysis.classification || 'Completed';
    const trustScore = analysis.trustScore ?? 0;
    const typeLabel = analysis.type === 'brand' ? 'Brand Sentiment' : 'News Fact-Check';

    // Color based on verdict
    const badgeColor =
      classification.toLowerCase().includes('real') || classification.toLowerCase().includes('positive')
        ? '#00C853'
        : classification.toLowerCase().includes('fake') || classification.toLowerCase().includes('negative')
        ? '#FF4757'
        : '#FFA502';

    const mailOptions = {
      from: fromAddress,
      to: toEmail,
      subject: `[Meiora AI] ${typeLabel} Ready: ${title.slice(0, 50)} (${classification} - ${trustScore}%)`,
      text: `Hello ${userName || 'User'},\n\nYour Meiora AI analysis for "${title}" is ready.\n\nType: ${typeLabel}\nVerdict: ${classification}\nTrust Score: ${trustScore}%\nSummary: ${analysis.summary || analysis.explanation || 'No summary provided.'}\n\nLog in to Meiora AI to view the full report.\n\nBest regards,\nMeiora AI Team`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #070B20; color: #E8EAFF; border-radius: 16px; overflow: hidden; border: 1px solid rgba(108, 92, 231, 0.35);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6C5CE7 0%, #00D4FF 100%); padding: 26px 24px; text-align: center;">
            <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; letter-spacing: 0.5px;">Meiora AI</h1>
            <p style="margin: 4px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">${typeLabel} Notification</p>
          </div>

          <!-- Body -->
          <div style="padding: 28px 24px;">
            <p style="font-size: 15px; color: #E8EAFF; margin: 0 0 16px;">Hello <strong>${userName || 'there'}</strong>,</p>
            <p style="font-size: 14px; color: #9BA3C8; line-height: 1.5; margin: 0 0 20px;">
              Your requested AI verification is complete. Here is a summary of the findings:
            </p>

            <!-- Card Result -->
            <div style="background: #0D1233; border: 1px solid rgba(108, 92, 231, 0.25); border-radius: 12px; padding: 20px; margin-bottom: 22px;">
              <h3 style="margin: 0 0 12px; color: #FFFFFF; font-size: 17px; line-height: 1.4;">${title}</h3>
              
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">
                <span style="display: inline-block; background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 13px;">
                  ${classification}
                </span>
                <span style="color: #00D4FF; font-weight: 700; font-size: 14px; margin-left: 8px;">
                  Trust Score: ${trustScore}%
                </span>
              </div>

              ${analysis.summary ? `
                <div style="margin-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px;">
                  <p style="font-size: 13px; color: #C5CBDD; line-height: 1.6; margin: 0;">
                    ${analysis.summary}
                  </p>
                </div>
              ` : ''}
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 26px 0 16px;">
              <a href="http://localhost:5173/history" style="background: linear-gradient(135deg, #6C5CE7, #00D4FF); color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                View Full Analysis in Meiora AI
              </a>
            </div>

            <p style="font-size: 11px; color: #5C6490; text-align: center; margin: 16px 0 0;">
              You received this email because <em>Email Notifications</em> is enabled in your Meiora AI Settings.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #090D28; padding: 14px 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <p style="margin: 0; font-size: 11px; color: #5C6490;">
              © ${new Date().getFullYear()} Meiora AI · Grounded Fact-Checking & Brand Sentiment Intelligence.
            </p>
          </div>
        </div>
      `,
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`[Email Service] Analysis notification sent to ${toEmail} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send analysis notification to ${toEmail}:`, err.message);
    // Non-blocking error
    return { success: false, error: err.message };
  }
};

