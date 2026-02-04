import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("Admin Layout: No user found redirecting")
        redirect("/")
    }

    const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    console.log("Admin Layout: User check", { id: user.id, role: userData?.role, error })

    if (userData?.role !== 'super_admin' && userData?.role !== 'admin') {
        console.log("Admin Layout: Unauthorized role redirecting")
        redirect("/")
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <nav className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text">
                        LingoAnti Admin
                    </h1>
                    <div className="text-sm text-gray-400">
                        {userData.role.toUpperCase()}
                    </div>
                </div>
            </nav>
            <main className="container mx-auto p-4">
                {children}
            </main>
        </div>
    )
}
