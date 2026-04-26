import { useEffect } from 'react';

export default function PrivacyPolicy() {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700 dark:text-gray-300">
          <p className="text-center text-lg leading-relaxed">
            CutToTech ("we", "our", "us") is committed to protecting your personal information and your privacy. This Privacy Policy explains how we collect, use, store, and protect your data when you access our website, register an account, or use any of our services ("Services").
          </p>
          <p className="text-center text-lg leading-relaxed">
            By accessing or using our Services, you agree to the terms described in this Privacy Policy.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mt-6 mb-3">1.1. Information You Provide</h3>
            <p>We collect personal information that you submit directly, including but not limited to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Full name</li>
              <li>Email address</li>
              <li>Password (encrypted — we never store raw passwords)</li>
              <li>IP address and device identifiers</li>
              <li>Contact details</li>
              <li>Any information submitted through forms or support requests</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-900 dark:text-white mt-6 mb-3">1.2. Automatically Collected Data</h3>
            <p>When using our Services, we may automatically collect:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Cookies and tracking technologies</li>
              <li>Device information (browser, OS, device type)</li>
              <li>Usage data (pages visited, time spent)</li>
              <li>Click logs and interactions</li>
              <li>Referrer data</li>
              <li>Location information (approximate, not precise GPS)</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-900 dark:text-white mt-6 mb-3">1.3. Third-Party Data</h3>
            <p>We may receive limited data from:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Analytics tools (e.g., Google Analytics)</li>
              <li>Advertising platforms (e.g., Google Ads, Meta Ads)</li>
              <li>Payment processors</li>
              <li>Authentication providers</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. How We Use Your Information</h2>
            <p>We use your data to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, operate, and maintain our Services</li>
              <li>Create and manage user accounts</li>
              <li>Improve user experience</li>
              <li>Analyze usage statistics and performance</li>
              <li>Communicate with you (support, updates, notifications)</li>
              <li>Detect and prevent fraud or misuse</li>
              <li>Comply with legal and regulatory obligations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Cookies and Tracking Technologies</h2>
            <p>CutToTech uses cookies and similar technologies to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Maintain sessions</li>
              <li>Track user activity</li>
              <li>Improve analytics and personalization</li>
            </ul>
            <p className="mt-4">
              You may disable cookies in your browser settings, but some features may not function properly.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Legal Basis (GDPR-compliant)</h2>
            <p>For users located in the EU/EEA, processing of personal data is based on:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your consent</li>
              <li>Contract performance</li>
              <li>Legitimate interests</li>
              <li>Legal compliance</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Data Storage and Security</h2>
            <p>We use industry-standard security practices to protect your data, including:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Encryption</li>
              <li>Firewalls</li>
              <li>Access control</li>
              <li>Secure hosting outside of Russia</li>
            </ul>
            <p className="font-medium mt-4">
              We do not sell personal data.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Data Sharing</h2>
            <p>We may share limited data with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Cloud hosting providers</li>
              <li>Analytics providers</li>
              <li>Advertising platforms</li>
              <li>Payment processors</li>
              <li>Legal authorities (only when required by law)</li>
            </ul>
            <p className="font-medium mt-4">
              We never share or sell your information to third parties for profit.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. International Data Transfers</h2>
            <p>
              Your data may be stored or processed in the United States, the EU, or other jurisdictions with adequate data protection laws.
            </p>
            <p className="mt-4">
              We use standard contractual clauses (SCCs) where required.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Your Rights</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data ("Right to be forgotten")</li>
              <li>Withdraw consent</li>
              <li>Request data export</li>
              <li>Object to processing</li>
            </ul>
            <p className="mt-4">
              To exercise rights, contact:{' '}
              <a 
                href="mailto:gga660360@gmail.com" 
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                gga660360@gmail.com
              </a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">9. Retention</h2>
            <p>We retain your data only as long as necessary for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Service operation</li>
              <li>Legal obligations</li>
              <li>Security purposes</li>
            </ul>
            <p className="mt-4">
              You may request deletion at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Continued use of our Services indicates acceptance of updates.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">11. Contact</h2>
            <p>For questions:</p>
            <ul className="list-none space-y-2 ml-4">
              <li>
                Email:{' '}
                <a 
                  href="mailto:gga660360@gmail.com" 
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  gga660360@gmail.com
                </a>
              </li>
              <li>Service Name: CutToTech</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
