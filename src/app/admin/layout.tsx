import AdminHeader from "@/components/admin/AdminHeader";
import RegisterSW from "@/components/RegisterSW";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell min-h-screen bg-[#fbfaf8] text-[#5b6678]">
      <RegisterSW />
      <AdminHeader />
      <div className="admin-shell-content">{children}</div>
    </div>
  );
}
