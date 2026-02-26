import React from 'react';
import { LegalLayout } from './LegalLayout';

export const PrivacyPolicy: React.FC = () => {
    return (
        <LegalLayout title="Privacy Policy" lastUpdated="February 25, 2026">
            <h2>1. Introduction</h2>
            <p>
                Derbix ("we", "us", "our") respects your privacy and is committed to protecting
                your personal data. This Privacy Policy explains how we collect, use, store, and
                protect your information when you use our sports data analytics platform.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>2.1 Information You Provide</h3>
            <ul>
                <li><strong>Account information:</strong> name, email address, and password when you register</li>
                <li><strong>Billing information:</strong> payment details processed securely by our payment processor (we do not store full card numbers)</li>
                <li><strong>Profile information:</strong> display name, preferences, and organization details</li>
                <li><strong>Communications:</strong> messages you send to our support team</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
                <li><strong>Usage data:</strong> features accessed, pages viewed, analytics reports generated</li>
                <li><strong>Device information:</strong> browser type, operating system, screen resolution</li>
                <li><strong>Log data:</strong> IP address, access times, referring URLs</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
                <li>Provide, maintain, and improve our sports analytics Service</li>
                <li>Process your subscription payments and manage your account</li>
                <li>Send transactional emails (account confirmation, billing receipts, plan changes)</li>
                <li>Monitor service usage to enforce subscription plan limits</li>
                <li>Analyze usage patterns to improve our AI models and user experience</li>
                <li>Respond to support requests and communicate important updates</li>
                <li>Detect and prevent fraud or abuse of the Service</li>
            </ul>

            <h2>4. Data Sharing</h2>
            <p>We do NOT sell your personal data. We share information only with:</p>
            <ul>
                <li><strong>Payment processor:</strong> to process subscription payments securely (Paddle/payment provider acts as Merchant of Record)</li>
                <li><strong>Infrastructure providers:</strong> hosting and database services necessary to operate the platform</li>
                <li><strong>AI services:</strong> anonymized match data sent to AI providers for analysis generation (no personal data included)</li>
                <li><strong>Legal compliance:</strong> when required by law, legal process, or to protect our rights</li>
            </ul>

            <h2>5. Data Retention</h2>
            <p>
                We retain your personal data for as long as your account is active or as needed
                to provide you with the Service. If you delete your account, we will remove your
                personal data within 30 days, except where retention is required by law or for
                legitimate business purposes (e.g., billing records).
            </p>

            <h2>6. Data Security</h2>
            <p>
                We implement industry-standard security measures to protect your data, including:
            </p>
            <ul>
                <li>Encryption in transit (TLS/HTTPS) and at rest</li>
                <li>Row-Level Security (RLS) policies in our database</li>
                <li>Secure authentication with hashed passwords</li>
                <li>Access controls limiting employee access to personal data</li>
            </ul>
            <p>
                While we strive to protect your data, no method of transmission over the Internet
                is 100% secure. We cannot guarantee absolute security.
            </p>

            <h2>7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
                <li><strong>Access:</strong> request a copy of the personal data we hold about you</li>
                <li><strong>Rectification:</strong> request correction of inaccurate personal data</li>
                <li><strong>Deletion:</strong> request deletion of your personal data</li>
                <li><strong>Portability:</strong> request a machine-readable copy of your data</li>
                <li><strong>Objection:</strong> object to certain processing of your data</li>
                <li><strong>Withdraw consent:</strong> withdraw consent where processing is based on consent</li>
            </ul>
            <p>
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:support@derbix.com">support@derbix.com</a>.
            </p>

            <h2>8. Cookies</h2>
            <p>
                We use essential cookies and local storage to maintain your authentication session
                and preferences. We do not use third-party tracking cookies for advertising purposes.
            </p>

            <h2>9. International Transfers</h2>
            <p>
                Your data may be processed in countries other than your own. We ensure appropriate
                safeguards are in place for international data transfers, including using service
                providers that comply with applicable data protection standards.
            </p>

            <h2>10. Children's Privacy</h2>
            <p>
                Our Service is not directed to individuals under 18 years of age. We do not
                knowingly collect personal data from minors. If we become aware that a minor
                has provided us with personal data, we will take steps to delete it.
            </p>

            <h2>11. Changes to This Policy</h2>
            <p>
                We may update this Privacy Policy from time to time. We will notify you of
                material changes by posting the updated policy on our website and updating the
                "Last updated" date. Continued use of the Service constitutes acceptance of
                the revised policy.
            </p>

            <h2>12. Contact Us</h2>
            <p>
                For privacy-related questions or to exercise your data rights, contact us at:{' '}
                <a href="mailto:support@derbix.com">support@derbix.com</a>
            </p>
        </LegalLayout>
    );
};
