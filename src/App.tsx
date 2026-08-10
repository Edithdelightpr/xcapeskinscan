import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Admin from "./pages/Admin.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import ClientProfile from "./pages/ClientProfile.tsx";
import AdminReportPreview from "./pages/AdminReportPreview.tsx";
import BookAppointment from "./pages/BookAppointment.tsx";
import PublicScheduling from "./pages/PublicScheduling.tsx";
import PublicIntake from "./pages/PublicIntake.tsx";
import SocialMediaIntake from "./pages/SocialMediaIntake.tsx";
import About from "./pages/About.tsx";
import Treatments from "./pages/Treatments.tsx";
import TreatmentCategory from "./pages/TreatmentCategory.tsx";
import TreatmentDetail from "./pages/TreatmentDetail.tsx";
import TreatmentFamily from "./pages/TreatmentFamily.tsx";
import Tropixa from "./pages/Tropixa.tsx";
import MenuRedirect from "./pages/MenuRedirect.tsx";
import Outreach from "./pages/Outreach.tsx";
import Consultation from "./pages/Consultation.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Checkout from "./pages/Checkout.tsx";
import CheckoutThanks from "./pages/CheckoutThanks.tsx";
import OutreachIntake from "./pages/OutreachIntake.tsx";
import OutreachPortal from "./pages/OutreachPortal.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import ManageBooking from "./pages/ManageBooking.tsx";
import PersonalReport from "./pages/PersonalReport.tsx";
import { AuthProvider } from "./hooks/useAuth";
import { ImpersonationProvider } from "./hooks/useImpersonation";
import ImpersonationBanner from "./components/admin/impersonation/ImpersonationBanner";
import AuthGuard from "./components/auth/AuthGuard";
import SupabaseHydrator from "./components/SupabaseHydrator";
import NavStatePersistor from "./components/NavStatePersistor";
import ReferralAttribution from "./components/ReferralAttribution";
import ReferralBounce from "./pages/ReferralBounce";
import DiscountPopup from "./components/public/DiscountPopup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
   <HelmetProvider>
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationProvider>
          <SupabaseHydrator />
          <NavStatePersistor />
          <ReferralAttribution />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <DiscountPopup />
            <ImpersonationBanner />
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Managed Supabase OAuth 2.1 consent — external MCP clients land here */}
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* Canonical short referral link → bounces to homepage with slug persisted */}
            <Route path="/r/:slug" element={<ReferralBounce />} />
            {/* Public booking routes (no auth) */}
            <Route path="/book-appointment" element={<BookAppointment />} />
            <Route path="/book/:slug" element={<BookAppointment />} />
            <Route path="/schedule" element={<PublicScheduling />} />
            <Route path="/schedule/:slug" element={<PublicScheduling />} />
            {/* In-store QR target — same flow, walk-in flag.
                /menu is now the public marketplace; legacy QR codes
                continue to work via /menu/scheduling. */}
            <Route path="/menu/scheduling" element={<PublicScheduling />} />
            {/* Public site pages */}
            <Route path="/about" element={<About />} />
            <Route path="/treatments" element={<Treatments />} />
            <Route path="/treatments/category/:slug" element={<TreatmentCategory />} />
            <Route path="/treatments/family/:slug" element={<TreatmentFamily />} />
            <Route path="/treatments/:slug" element={<TreatmentDetail />} />
            <Route path="/tropixa" element={<Tropixa />} />
            {/* Back-compat: legacy /menu and /products routes */}
            <Route path="/menu" element={<MenuRedirect />} />
            <Route path="/products" element={<Navigate to="/tropixa" replace />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/thanks" element={<CheckoutThanks />} />
            <Route path="/outreach" element={<Outreach />} />
            <Route path="/outreach/intake/:slug" element={<OutreachIntake />} />
            <Route path="/outreach/portal" element={<AuthGuard><OutreachPortal /></AuthGuard>} />
            <Route path="/consultation" element={<Consultation />} />
            {/* Public outreach intake — captures leads from QR scans */}
            <Route path="/intake" element={<PublicIntake />} />
            <Route path="/intake/:slug" element={<PublicIntake />} />
            {/* Social-media / ManyChat campaign intake — separate from outreach */}
            <Route path="/social-media-intake" element={<SocialMediaIntake />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/manage-booking" element={<ManageBooking />} />
            {/* Personal Report — token-only public link. Never indexed. */}
            <Route path="/report/:token" element={<PersonalReport />} />
            <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
            <Route path="/admin/clients/:id" element={<AuthGuard><ClientProfile /></AuthGuard>} />
            {/* Staff-only Personal Report preview. Uses the standard AuthGuard
                so any role that can open Client → Reports (admin, front_desk,
                medical_aesthetician) can also preview. The underlying edge
                function repeats the role check server-side. */}
            <Route
              path="/admin/clients/:id/report-preview"
              element={<AuthGuard><AdminReportPreview /></AuthGuard>}
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </BrowserRouter>
   </HelmetProvider>
  </QueryClientProvider>
);

export default App;
