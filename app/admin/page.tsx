import { getAdminStats } from "@/actions/admin"
import AdminDashboard from "@/components/AdminDashboard"

export default async function AdminPage() {
    const stats = await getAdminStats()

    return (
        <AdminDashboard stats={stats} />
    )
}
