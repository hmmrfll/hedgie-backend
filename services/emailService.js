const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.log('SMTP connection error:', error);
    } else {
        console.log('Server is ready to send emails');
    }
});

async function sendEmail({ to, subject, text, resetToken }) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const mailOptions = {
        from: `"HEDGIE Support" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: `
            <h1>Password Reset</h1>
            <p>You have requested to reset your password.</p>
            <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
}

module.exports = sendEmail;