import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SITE_URL } from "../lib/seo";

function PrivacyPolicy() {
  return (
    <section className="max-w-[920px] mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14 animate-fade-in">
      <Helmet>
        <title>Privacy Policy | Uni Deals</title>
        <meta
          name="description"
          content="Learn how Uni Deals collects, uses, and protects your personal data on Sri Lanka's student discount platform."
        />
        <link rel="canonical" href={`${SITE_URL}/privacy`} />
      </Helmet>
      <header className="mb-8 md:mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant/60 font-body font-semibold">
          Uni Deals Trust Center
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-headline font-black tracking-tight text-on-background">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant/70 font-body">
          Last updated: September 1, 2026
        </p>
      </header>

      <div className="space-y-8 text-on-surface font-body leading-7">
        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            1. Who We Are
          </h2>
          <p>
            Uni Deals is a student discount platform serving universities and
            partner businesses in Sri Lanka. This Privacy Policy explains how we
            collect, use, protect, and disclose personal information when you
            use our website, mobile app, and related services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            2. Age Requirement
          </h2>
          <p>
            Uni Deals is not designed for children under 13. You must be at
            least 13 years old to create an account or use the service. We do
            not knowingly collect personal information from children under 13.
            If you believe a child under 13 has created an account, contact us
            at unideals.lk@gmail.com and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            3. Information We Collect
          </h2>
          <p>
            We may collect account and profile data such as name, email address,
            user role, university-related verification details, usage events,
            and saved deal interactions. Partner and admin users may also
            provide business and offer-management details relevant to campaign
            publishing.
          </p>
          <p className="mt-3">
            If you verify with a student ID, we collect photos of that document
            (front and, when requested, back). If you use the Uni Deals mobile
            app and enable notifications, we store a device push token so we
            can send the alerts you chose. We do not collect payment card
            details on Uni Deals.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            4. How We Use Your Data
          </h2>
          <p>
            We use data to authenticate accounts, support student verification,
            assign and enforce role-based permissions, deliver relevant deals,
            prevent fraud, respond to support requests, send optional app
            notifications you enable, and improve service reliability and user
            experience.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            5. Student ID Documents
          </h2>
          <p>
            ID photos are stored in a private storage bucket. They are not
            public files. When an admin reviews a request, they open the images
            through short-lived signed URLs that expire after about five
            minutes. We retain ID documents only as long as needed to complete
            verification, prevent duplicate or fraudulent enrolments, and meet
            legal obligations, then we delete them with your account or earlier
            when they are no longer required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            6. Camera and Push Notifications
          </h2>
          <p>
            Partner and admin users who scan in-store tickets may grant camera
            access on the partner scanner. Camera frames are processed on the
            device to read QR codes. We do not upload a live video stream of
            the scan.
          </p>
          <p className="mt-3">
            The mobile app may store Expo push tokens on your account so we can
            send optional deal or event alerts. You can disable notifications
            in the device settings. Tokens are removed when you delete your
            account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            7. Verification, Security, and Access Control
          </h2>
          <p>
            Uni Deals uses safeguards such as authenticated sessions,
            role-based authorization, controlled data access paths, and
            verification checks to reduce unauthorized access. While no system
            can be guaranteed 100% secure, we apply industry-standard measures
            to protect data in transit and at rest through our infrastructure
            providers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            8. Third-Party Partners and Service Providers
          </h2>
          <p>
            Deals shown on Uni Deals are provided by third-party partners. We
            may share only the minimum necessary information with trusted
            service providers and infrastructure vendors for hosting,
            authentication, analytics, and communications. Partner businesses
            are independently responsible for how they handle transactions and
            redemptions under their own policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            9. Data Retention
          </h2>
          <p>
            We retain personal data only for as long as needed to provide the
            service, meet legal and compliance obligations, resolve disputes,
            and enforce platform terms. Retention periods may vary by data type
            and operational necessity. When you delete your account we remove
            the records described in Your Rights below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            10. Cookies and Similar Technologies
          </h2>
          <p>
            We may use cookies or similar technologies for login persistence,
            security, and analytics. On the live site we use Google Analytics 4
            and Microsoft Clarity to understand how pages are used; Clarity
            session recordings mask typed input, including student emails and
            registration IDs. You can manage browser preferences, but disabling
            certain cookies may affect platform functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            11. Your Rights
          </h2>
          <p>
            Subject to applicable law, including the Sri Lankan Personal Data
            Protection Act where applicable, you may request access or
            correction of your personal information. You can delete your Uni
            Deals account yourself at any time on the{" "}
            <Link
              to="/delete-account"
              className="text-primary font-semibold hover:underline"
            >
              Delete account
            </Link>{" "}
            page ({SITE_URL}/delete-account). You do not need to email support
            to close an account. Sign in if prompted, confirm, and we will
            remove your login, role, ID documents, related tickets, and app
            push tokens, then sign you out.
          </p>
          <p className="mt-3">
            For other privacy questions, contact unideals.lk@gmail.com.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            12. International Transfers
          </h2>
          <p>
            Our technology providers may process data in multiple jurisdictions.
            Where cross-border transfer occurs, we apply appropriate safeguards
            and contractual protections consistent with applicable legal
            requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-headline font-extrabold mb-2">
            13. Contact
          </h2>
          <p>
            For privacy questions or requests, contact: unideals.lk@gmail.com.
          </p>
        </section>
      </div>
    </section>
  );
}

export default PrivacyPolicy;
