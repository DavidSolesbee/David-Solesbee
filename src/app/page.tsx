import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { LogoCloud } from "@/components/marketing/LogoCloud";
import { ValueProposition } from "@/components/marketing/ValueProposition";
import { PlatformOverview } from "@/components/marketing/PlatformOverview";
import { ExecutiveInsights } from "@/components/marketing/ExecutiveInsights";
import { AutomatedReporting } from "@/components/marketing/AutomatedReporting";
import { RoleBasedAnalytics } from "@/components/marketing/RoleBasedAnalytics";
import { InsightsAI } from "@/components/marketing/InsightsAI";
import { BusinessImpact } from "@/components/marketing/BusinessImpact";
import { CustomerStories } from "@/components/marketing/CustomerStories";
import { FounderStory } from "@/components/marketing/FounderStory";
import { SecuritySection } from "@/components/marketing/SecuritySection";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Solesbee Analytics — See your entire business clearly",
  description:
    "Solesbee Analytics centralizes your data into one operating view — executive dashboards, automated reporting, role-based analytics, and AI-assisted insights for multi-location organizations.",
};

/**
 * Public marketing homepage for Solesbee Analytics.
 *
 * Dark, enterprise SaaS presentation composed from modular sections. This page
 * is purely public and uses only fictional marketingDemoData — it never touches
 * client data or the dealership database. The "Login" / "Client Login" actions
 * route to the existing authentication at /login, unchanged.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-night-950 text-white antialiased">
      <MarketingNav />
      <main>
        <HeroSection />
        <LogoCloud />
        <ValueProposition />
        <PlatformOverview />
        <ExecutiveInsights />
        <AutomatedReporting />
        <RoleBasedAnalytics />
        <InsightsAI />
        <BusinessImpact />
        <CustomerStories />
        <FounderStory />
        <SecuritySection />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
