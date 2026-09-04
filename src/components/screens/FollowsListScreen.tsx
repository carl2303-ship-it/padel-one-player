import { useState, useEffect } from 'react'
import {
  followUser,
  unfollowUser,
  getFollowingList,
  getFollowersList,
  levelColors,
  getInitials,
  type CommunityPlayer,
} from '../../lib/communityData'

import { ChevronLeft } from 'lucide-react'
export default function FollowsListScreen({
  targetUserId,
  myUserId,
  onBack,
  onOpenPlayerProfile,
}: {
  targetUserId: string
  myUserId: string
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')
  const [followingList, setFollowingList] = useState<CommunityPlayer[]>([])
  const [followersList, setFollowersList] = useState<CommunityPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getFollowingList(targetUserId),
      getFollowersList(targetUserId),
    ]).then(([following, followers]) => {
      setFollowingList(following)
      setFollowersList(followers)
      setLoading(false)
    })
  }, [targetUserId])

  const handleToggleFollow = async (userId: string, currentlyFollowing: boolean) => {
    if (currentlyFollowing) {
      await unfollowUser(myUserId, userId)
      // Update both lists
      setFollowingList(prev => prev.filter(p => p.user_id !== userId))
      setFollowersList(prev => prev.map(p => p.user_id === userId ? { ...p, is_following: false } : p))
    } else {
      await followUser(myUserId, userId)
      setFollowersList(prev => prev.map(p => p.user_id === userId ? { ...p, is_following: true } : p))
    }
  }

  const currentList = activeTab === 'following' ? followingList : followersList

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors mb-3">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Seguidores</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('following')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'following' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          A seguir
        </button>
        <button
          onClick={() => setActiveTab('followers')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'followers' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          Seguidores
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      ) : currentList.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">
            {activeTab === 'following' ? 'Ainda não segue ninguém' : 'Ainda não tem seguidores'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map((p) => {
            const colors = levelColors(p.level)
            const lvl = p.level
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden cursor-pointer"
                    onClick={() => onOpenPlayerProfile(p.user_id)}
                  >
                    {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : getInitials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenPlayerProfile(p.user_id)}>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {lvl && <span className={`text-xs font-black px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>}
                      {p.location && <span className="text-xs text-gray-400">{p.location}</span>}
                    </div>
                  </div>
                  {p.user_id !== myUserId && (
                    <button
                      onClick={() => handleToggleFollow(p.user_id, p.is_following ?? false)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        p.is_following
                          ? 'border border-orange-300 text-orange-600 hover:bg-orange-50'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      {p.is_following ? 'Seguindo' : 'Seguir'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Perfil de Outro Jogador (a partir da Comunidade) ----------
