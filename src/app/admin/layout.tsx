import AdminHeader from "@/components/admin/AdminHeader";
import RegisterSW from "@/components/RegisterSW";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdfb_0%,#f7fbfc_100%)] text-slate-700">
      <RegisterSW />
      <AdminHeader />
      {children}
    </div>
  );
}
