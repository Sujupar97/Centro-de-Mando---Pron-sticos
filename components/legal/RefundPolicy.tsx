import React from 'react';
import { LegalLayout } from './LegalLayout';

export const RefundPolicy: React.FC = () => {
    return (
        <LegalLayout title="Refund Policy" lastUpdated="February 25, 2026">
            <h2>1. Overview</h2>
            <p>
                At Derbix, we want you to be satisfied with your subscription. This Refund Policy
                outlines the conditions under which we offer refunds for our paid subscription plans.
            </p>

            <h2>2. Free Trial and Free Plan</h2>
            <p>
                Derbix offers a free plan with limited features. We encourage you to explore the
                platform using the free plan before committing to a paid subscription. No payment
                is required for the free plan, and therefore no refund applies.
            </p>

            <h2>3. Paid Subscriptions</h2>
            <h3>3.1 Monthly Plans</h3>
            <p>
                Monthly subscriptions may be cancelled at any time. Upon cancellation, you will
                retain access to your paid features until the end of your current billing period.
                <strong> We do not provide prorated refunds for partial months.</strong>
            </p>

            <h3>3.2 Annual Plans</h3>
            <p>
                Annual subscriptions offer a discounted rate compared to monthly billing. If you
                cancel an annual subscription, you will retain access until the end of your current
                annual billing period. Refunds for annual plans are handled on a case-by-case basis
                within the first 14 days of purchase (see Section 4).
            </p>

            <h2>4. Refund Eligibility</h2>
            <p>You may be eligible for a refund if:</p>
            <ul>
                <li>You request a refund within <strong>14 days</strong> of your initial purchase or renewal</li>
                <li>You experienced a technical issue that prevented you from using the Service and our support team was unable to resolve it</li>
                <li>You were charged incorrectly or experienced a billing error</li>
            </ul>

            <h3>Refunds are NOT available for:</h3>
            <ul>
                <li>Dissatisfaction with analytics results or predictions (analytics involve inherent uncertainty)</li>
                <li>Failure to cancel before an automatic renewal</li>
                <li>Requests made more than 14 days after purchase or renewal</li>
                <li>Accounts that have been suspended or terminated for Terms of Service violations</li>
            </ul>

            <h2>5. How to Request a Refund</h2>
            <p>To request a refund:</p>
            <ol>
                <li>Email us at <a href="mailto:support@derbix.com">support@derbix.com</a> with the subject line "Refund Request"</li>
                <li>Include your account email and the reason for your request</li>
                <li>We will review your request and respond within 5 business days</li>
            </ol>

            <h2>6. Refund Processing</h2>
            <p>
                Approved refunds will be processed through our payment processor and returned to
                your original payment method. Depending on your bank or card issuer, it may take
                5-10 business days for the refund to appear on your statement.
            </p>

            <h2>7. Cancellation</h2>
            <p>
                You can cancel your subscription at any time through your subscription management
                portal (accessible from your account settings). Cancellation takes effect at the
                end of your current billing period — you will not lose access immediately.
            </p>

            <h2>8. Changes to This Policy</h2>
            <p>
                We reserve the right to modify this Refund Policy at any time. Changes will be
                posted on this page with an updated "Last updated" date. Material changes will
                be communicated to active subscribers.
            </p>

            <h2>9. Contact</h2>
            <p>
                For refund inquiries or billing questions, contact us at:{' '}
                <a href="mailto:support@derbix.com">support@derbix.com</a>
            </p>
        </LegalLayout>
    );
};
