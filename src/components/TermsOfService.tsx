import { useEffect } from 'react';

export default function TermsOfService() {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700 dark:text-gray-300">
          <p className="text-center text-lg leading-relaxed">
            Welcome to CutToTech. These Terms of Service ("Terms") govern your access and use of our website and services ("Services"). By using our Services, you agree to be bound by these Terms.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Use of the Service</h2>
            <p>You agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the Service legally</li>
              <li>Not interfere with system integrity</li>
              <li>Provide accurate registration information</li>
              <li>Not attempt to bypass security systems</li>
            </ul>
            <p className="mt-4">
              We may suspend accounts for violations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Accounts</h2>
            <p>You must:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Maintain the confidentiality of your login credentials</li>
              <li>Be responsible for activities under your account</li>
              <li>Notify us of unauthorized access</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Acceptable Use</h2>
            <p>You may NOT:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the Service for fraudulent or illegal purposes</li>
              <li>Scrape or overload our systems</li>
              <li>Upload harmful content or malware</li>
              <li>Reverse engineer our technology</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Intellectual Property</h2>
            <p>
              All content, branding, and technology of CutToTech are protected under copyright and may not be copied or redistributed without permission.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">5. Payments (if applicable)</h2>
            <p>If the Service includes paid features:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Prices may change with notice</li>
              <li>Payments are final unless required by law</li>
              <li>Failure to pay may result in account suspension</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">6. Disclaimer</h2>
            <p>
              The Service is provided "as is" without warranties of any kind.
            </p>
            <p className="mt-4">
              We do not guarantee uninterrupted operation or error-free performance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">7. Limitation of Liability</h2>
            <p>CutToTech is not liable for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Loss of data</li>
              <li>Service downtime</li>
              <li>Financial losses resulting from misuse</li>
              <li>Third-party actions</li>
            </ul>
            <p className="mt-4">
              Maximum liability is limited to the amount paid for the Service (if any).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">8. Termination</h2>
            <p>We may terminate access for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Policy violations</li>
              <li>Illegal activity</li>
              <li>Security risks</li>
            </ul>
            <p className="mt-4">
              Users may delete their account at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">9. Governing Law</h2>
            <p>
              These Terms are governed by applicable international laws, including those of the EU and USA.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">10. Changes to the Terms</h2>
            <p>
              We may update these Terms. Continued use means acceptance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">11. Contact</h2>
            <p>
              Email:{' '}
              <a 
                href="mailto:gga660360@gmail.com" 
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                gga660360@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
