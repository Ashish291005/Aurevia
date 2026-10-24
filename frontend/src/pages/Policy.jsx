import { Link, useLocation } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";
import NotFound from "./NotFound";

// Store policies (privacy, terms, returns, shipping). Contact details, delivery fee and the free-delivery
// threshold come from admin → Settings, so the pages stay accurate when those change.
const UPDATED = "24 October 2026";

const POLICIES = {
  "privacy-policy": {
    title: "Privacy Policy",
    sections: (s) => [
      ["Who we are", `Aurevia ("we", "us") runs the online store at aureviajewels.co.in, selling fashion jewellery and gift boxes in India. This policy explains what personal information we collect, why, and the choices you have. Questions? Write to ${s.store_email}.`],
      ["What we collect", [
        "Details you give us at checkout or when creating an account: name, email address, mobile number and delivery address.",
        "If you sign in with Google: your name, email address and profile picture, as shared by Google. We never see your Google password.",
        "Order details: what you bought, amounts, coupon used, delivery and payment status.",
        "Messages you send through the contact form, and your email if you subscribe to our newsletter.",
        "Basic technical data such as browser type and pages visited, used to keep the site working and secure.",
      ]],
      ["Payments", "Online payments are processed by Razorpay. Card, UPI and bank details are entered on Razorpay's secure checkout and are not stored by us. We only receive a payment reference and its status."],
      ["How we use your information", [
        "To process, deliver and support your orders, including order updates by email, SMS or WhatsApp.",
        "To run your account, remember you on your device and show your order history.",
        "To answer your questions, handle returns and refunds, and prevent fraud.",
        "To send offers and news only if you subscribed; you can unsubscribe at any time.",
      ]],
      ["Sharing", "We share only what is needed with service providers who help us run the store: payment processing (Razorpay), courier and logistics partners, hosting and database providers, and email/messaging services. We do not sell your personal information."],
      ["Cookies and local storage", "We use essential cookies to keep you signed in (for up to 30 days on your device) and your browser's storage to remember your cart, wishlist and saved checkout details. You can clear these at any time in your browser settings."],
      ["How long we keep it", "We keep order records for as long as required for accounting, tax and legal purposes. You can ask us to delete your account and personal information that we are not required to keep."],
      ["Your rights", `You can ask to access, correct or delete your personal information, or withdraw consent for marketing, by emailing ${s.store_email}. We will respond within a reasonable time.`],
      ["Grievance officer", `In line with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, you can raise any concern with our grievance officer at ${s.store_email}${s.store_phone ? ` or ${s.store_phone}` : ""}${s.store_address ? `, ${s.store_address}` : ""}.`],
      ["Changes", "We may update this policy from time to time. The date at the top shows when it last changed."],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    sections: (s) => [
      ["About these terms", "By using aureviajewels.co.in or placing an order, you agree to these terms. Please read them along with our Privacy Policy, Refund & Returns Policy and Shipping Policy."],
      ["Our products", "Aurevia sells fashion (artificial) jewellery: gold-plated, rose-gold-plated, American Diamond (AD), kundan and similar pieces, plus gift boxes. Our products are not made of real gold, silver or precious stones. Colours may look slightly different on different screens, and handcrafted pieces can vary a little from the photos."],
      ["Prices and payment", `All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise. Delivery is ${s.shipping_fee > 0 ? `${formatPrice(s.shipping_fee)} per order${s.free_shipping_threshold > 0 ? `, free on orders of ${formatPrice(s.free_shipping_threshold)} or more` : ""}` : "free"}. You can pay online through Razorpay or choose cash on delivery where available.`],
      ["Orders", "An order is confirmed once you receive an order number. We may cancel an order (and refund any payment in full) if an item is out of stock, a price was shown incorrectly, or we suspect fraud."],
      ["Coupons and offers", "Coupons are subject to their own terms shown with each code (minimum order, validity, usage limits). Only one coupon can be used per order, coupons have no cash value, and we may withdraw an offer at any time."],
      ["Accounts", "You are responsible for keeping your account secure. You can sign in with email and password or with Google. Tell us straight away if you notice anything suspicious."],
      ["Use of the site", "Please don't misuse the site, attempt to access it without permission, or copy its content, photos or designs for commercial use. All content on this site belongs to Aurevia."],
      ["Liability", "We take care to describe products accurately and deliver them safely. Our liability for any order is limited to the amount you paid for it, except where the law does not allow such a limit."],
      ["Governing law", "These terms are governed by the laws of India. Any disputes are subject to the courts of the city where Aurevia is registered."],
      ["Contact", `Questions about these terms? Write to ${s.store_email}${s.store_phone ? ` or call ${s.store_phone}` : ""}.`],
    ],
  },
  "refund-policy": {
    title: "Refund & Returns Policy",
    sections: (s) => [
      ["7-day returns", "If you are not happy with your purchase, you can request a return within 7 days of delivery. Items must be unused, in their original condition and packaging, with tags and the gift box included."],
      ["Damaged or wrong item", "If your order arrives damaged, defective or different from what you ordered, contact us within 48 hours of delivery with photos (an unboxing video helps) and we will replace it or refund it in full, including delivery charges."],
      ["How to request a return", `Email ${s.store_email}${s.store_phone ? ` or call ${s.store_phone}` : ""} with your order number and the reason. We will arrange a pickup where available, or share the return address.`],
      ["Refunds", [
        "Once we receive and check the returned item, we process the refund within 2 working days.",
        "Online payments are refunded to the original payment method; banks usually take 5–7 working days to show it.",
        "Cash on delivery orders are refunded by bank transfer or UPI to the details you share with us.",
        "Delivery charges are not refundable unless the item was damaged, defective or wrong.",
      ]],
      ["Cancellations", "You can cancel an order before it ships from My Account → Orders, or by contacting us. Online payments for cancelled orders are refunded in full to the original payment method."],
      ["Coupons", "If an order placed with a coupon is returned or cancelled, the coupon is not reissued and its value is not refunded."],
    ],
  },
  "shipping-policy": {
    title: "Shipping Policy",
    sections: (s) => [
      ["Where we deliver", "We deliver across India through trusted courier partners."],
      ["Delivery charges", s.shipping_fee > 0 ? `Delivery is ${formatPrice(s.shipping_fee)} per order${s.free_shipping_threshold > 0 ? ` and free on orders of ${formatPrice(s.free_shipping_threshold)} or more` : ""}. Free-delivery coupons, when available, waive this charge.` : "Delivery is free on all orders."],
      ["Dispatch and delivery times", [
        "Orders are packed and dispatched within 1–2 working days.",
        "Delivery usually takes 3–7 working days after dispatch, depending on your location.",
        "Remote areas, public holidays and peak sale periods can take a little longer.",
      ]],
      ["Tracking", "When your order ships we add the courier tracking number to it. You can follow your order any time on the Track Order page or in My Account → Orders."],
      ["Cash on delivery", "Cash on delivery is available across India. Please keep the exact amount ready; our courier partners may not carry change."],
      ["Packaging", "Every order arrives in our signature gift box with a note card, at no extra cost."],
      ["Questions", `Write to ${s.store_email}${s.store_phone ? ` or call ${s.store_phone}` : ""} and we will help.`],
    ],
  },
};

export const POLICY_LINKS = [
  { to: "/shipping-policy", label: "Shipping Policy" },
  { to: "/refund-policy", label: "Refunds & Returns" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms & Conditions" },
];

export default function Policy() {
  const slug = useLocation().pathname.replace(/^\/+|\/+$/g, "");
  const settings = useSettings();
  const policy = POLICIES[slug];
  usePageTitle(policy?.title || "Page not found");
  if (!policy) return <NotFound />;

  return (
    <div data-testid={`policy-${slug}`} className="pt-20 sm:pt-24">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16 font-body">
        <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-3">Aurevia</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-stone-900 mb-2">{policy.title}</h1>
        <p className="text-sm text-stone-500 mb-10">Last updated {UPDATED}</p>
        <div className="space-y-8">
          {policy.sections(settings).map(([heading, body]) => (
            <section key={heading}>
              <h2 className="font-heading text-2xl text-stone-900 mb-2">{heading}</h2>
              {Array.isArray(body)
                ? <ul className="list-disc pl-5 space-y-1.5 text-stone-600 leading-relaxed">{body.map((b, i) => <li key={i}>{b}</li>)}</ul>
                : <p className="text-stone-600 leading-relaxed">{body}</p>}
            </section>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-stone-200 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {POLICY_LINKS.filter(l => l.to !== `/${slug}`).map(l => <Link key={l.to} to={l.to} className="text-burgundy hover:text-gold">{l.label}</Link>)}
        </div>
      </div>
    </div>
  );
}
