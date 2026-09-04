import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Search, Plus, Users, X, Heart, Image, Video, Send, Trash2 } from 'lucide-react'
import { useI18n } from '../../lib/i18nContext'
import { isLikelyTeamLabel } from '../../lib/matchPlayerNames'
import {
  followUser,
  unfollowUser,
  getFollowingIds,
  getSuggestedPlayers,
  createPost,
  deletePost,
  searchPlayers,
  levelColors,
  getInitials,
  type CommunityPlayer,
  type CommunityPost,
  type FeedItem,
  type FeedMatchItem,
  getUnifiedFeed,
} from '../../lib/communityData'
import {
  createGroup,
  getMyGroups,
  uploadGroupImage,
  getMyGroupInvites,
  respondToGroupInvite,
  type CommunityGroup,
  type GroupInvite,
} from '../../lib/communityGroups'
import { GameCardPlaytomic, type PlayerMatchForCard } from '../shared/matchUi'
export default function CommunityScreen({ userId, playerAccountId: _playerAccountId, playerAvatar, playerName, onOpenPlayerProfile, onOpenGroup }: { userId: string; playerAccountId: string; playerAvatar?: string | null; playerName?: string; onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void; onOpenGroup: (groupId: string) => void }) {
  void _playerAccountId
  const { t } = useI18n()
  // Feed state
  const [suggestions, setSuggestions] = useState<CommunityPlayer[]>([])
  const [, setPosts] = useState<CommunityPost[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  // Groups state
  const [myGroups, setMyGroups] = useState<CommunityGroup[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupImage, setNewGroupImage] = useState<File | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)

  const handlePlayerClick = async (playerNameClicked: string) => {
    if (!playerNameClicked || isLikelyTeamLabel(playerNameClicked)) return
    const { findPlayerAccountByName } = await import('../../lib/classes')
    const acc = await findPlayerAccountByName(playerNameClicked)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerNameClicked })
    }
  }

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostText, setNewPostText] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [newPostVideo, setNewPostVideo] = useState<File | null>(null)
  const [postingLoading, setPostingLoading] = useState(false)

  // Global player search
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<CommunityPlayer[]>([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)

  // Load feed + groups data
  useEffect(() => {
    loadFeed()
    loadGroups()
  }, [userId])

  async function loadFeed() {
    setFeedLoading(true)
    try {
      const [suggestedData, unifiedData, ids] = await Promise.all([
        getSuggestedPlayers(userId),
        getUnifiedFeed(userId),
        getFollowingIds(userId),
      ])
      setSuggestions(suggestedData)
      setFeedItems(unifiedData)
      setPosts(unifiedData.filter(i => i.type === 'post').map(i => i.data as CommunityPost))
      setFollowingSet(new Set(ids))
    } catch (err) {
      console.error('[Community] Load feed error:', err)
    }
    setFeedLoading(false)
  }

  async function loadGroups() {
    setGroupsLoading(true)
    try {
      const [groups, invites] = await Promise.all([
        getMyGroups(userId),
        getMyGroupInvites(userId),
      ])
      setMyGroups(groups)
      setGroupInvites(invites)
    } catch (err) {
      console.error('[Community] Load groups error:', err)
    }
    setGroupsLoading(false)
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    let imageUrl: string | undefined
    if (newGroupImage) {
      imageUrl = (await uploadGroupImage(newGroupImage)) || undefined
    }
    const result = await createGroup({ name: newGroupName.trim(), description: newGroupDesc.trim() || undefined, imageUrl })
    if (result.success && result.groupId) {
      setShowCreateGroup(false)
      setNewGroupName('')
      setNewGroupDesc('')
      setNewGroupImage(null)
      await loadGroups()
      onOpenGroup(result.groupId)
    } else {
      alert(result.error || 'Erro ao criar grupo')
    }
    setCreatingGroup(false)
  }

  async function handleRespondInvite(inviteId: string, accept: boolean) {
    const result = await respondToGroupInvite(inviteId, accept)
    if (result.success) {
      setGroupInvites(prev => prev.filter(i => i.id !== inviteId))
      if (accept) loadGroups()
    }
  }

  async function handleFollow(targetUserId: string) {
    const ok = await followUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => new Set([...prev, targetUserId]))
      setSuggestions(prev => prev.filter(s => s.user_id !== targetUserId))
    }
  }

  async function handleCreatePost() {
    if (!newPostText.trim() && !newPostImage && !newPostVideo) return
    setPostingLoading(true)
    const ok = await createPost(userId, newPostText, newPostImage || undefined, newPostVideo || undefined)
    if (ok) {
      setNewPostText('')
      setNewPostImage(null)
      setNewPostVideo(null)
      setShowNewPost(false)
      await loadFeed()
    }
    setPostingLoading(false)
  }

  async function handleDeletePost(postId: string) {
    const ok = await deletePost(postId)
    if (ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
    }
  }

  // Auto-search when typing (debounced)
  useEffect(() => {
    if (playerSearchQuery.trim().length < 2) {
      setPlayerSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setPlayerSearching(true)
      const results = await searchPlayers(playerSearchQuery, [userId])
      const enriched = results.map(p => ({ ...p, is_following: followingSet.has(p.user_id) }))
      setPlayerSearchResults(enriched)
      setPlayerSearching(false)
      setShowPlayerSearch(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [playerSearchQuery])

  async function handleFollowFromSearch(targetUserId: string) {
    const ok = await followUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => new Set([...prev, targetUserId]))
      setPlayerSearchResults(prev => prev.map(p => p.user_id === targetUserId ? { ...p, is_following: true } : p))
      setSuggestions(prev => prev.filter(s => s.user_id !== targetUserId))
    }
  }

  async function handleUnfollowFromSearch(targetUserId: string) {
    const ok = await unfollowUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => { const n = new Set(prev); n.delete(targetUserId); return n })
      setPlayerSearchResults(prev => prev.map(p => p.user_id === targetUserId ? { ...p, is_following: false } : p))
    }
  }

  function timeAgo(dateStr: string): string {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="animate-fade-in pb-4">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-red-600" />
          Comunidade
        </h1>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={playerSearchQuery}
            onChange={e => {
              setPlayerSearchQuery(e.target.value)
              if (e.target.value.trim().length === 0) {
                setPlayerSearchResults([])
                setShowPlayerSearch(false)
              } else {
                setShowPlayerSearch(true)
              }
            }}
            onFocus={() => { if (playerSearchQuery.trim().length >= 2) setShowPlayerSearch(true) }}
            placeholder={t.games.searchPlayers}
            className="w-full pl-9 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors"
          />
          {playerSearchQuery && (
            <button
              onClick={() => { setPlayerSearchQuery(''); setPlayerSearchResults([]); setShowPlayerSearch(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showPlayerSearch && (
          <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-80 overflow-y-auto">
            {playerSearching ? (
              <div className="text-center py-6 text-gray-400 text-sm">A pesquisar...</div>
            ) : playerSearchResults.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {playerSearchResults.map(p => {
                  const lvl = p.level
                  const colors = levelColors(p.level)
                  return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onOpenPlayerProfile(p.user_id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : getInitials(p.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lvl && <span className={`text-xs font-black px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>}
                          {p.location && <span className="text-xs text-gray-400">{p.location}</span>}
                        </div>
                      </div>
                    </div>
                    {p.is_following ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnfollowFromSearch(p.user_id) }}
                        className="px-3 py-1.5 text-xs font-semibold border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        A seguir
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFollowFromSearch(p.user_id) }}
                        className="px-3 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Seguir
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : playerSearchQuery.trim().length >= 2 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">Nenhum jogador encontrado</p>
                <p className="text-xs text-gray-400 mt-1">Tenta outro nome</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Escreve pelo menos 2 letras para pesquisar</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== GROUPS ==================== */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            Meus Grupos
          </h2>
          <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700">
            <Plus className="w-4 h-4" /> Criar
          </button>
        </div>

        {/* Group invites */}
        {groupInvites.length > 0 && (
          <div className="mb-3 space-y-2">
            {groupInvites.map(inv => (
              <div key={inv.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                    {inv.group_image_url ? <img src={inv.group_image_url} className="w-full h-full rounded-full object-cover" /> : '👥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inv.group_name}</p>
                    <p className="text-xs text-gray-500">Convite de {inv.inviter_name}</p>
                  </div>
                </div>
                {inv.group_description && (
                  <p className="text-xs text-gray-600 mt-2 ml-[52px] line-clamp-2">{inv.group_description}</p>
                )}
                <div className="flex gap-2 mt-3 ml-[52px]">
                  <button onClick={() => handleRespondInvite(inv.id, true)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg">Aceitar</button>
                  <button onClick={() => handleRespondInvite(inv.id, false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group list */}
        {groupsLoading ? (
          <div className="text-center py-4 text-gray-400 text-sm">{t.common.loading}</div>
        ) : myGroups.length > 0 ? (
          <div className="space-y-2">
            {myGroups.map(group => (
              <div key={group.id} onClick={() => onOpenGroup(group.id)} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 overflow-hidden">
                  {group.image_url ? <img src={group.image_url} className="w-full h-full object-cover" /> : group.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
                    {group.my_role === 'admin' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {group.member_count} {group.member_count === 1 ? 'membro' : 'membros'}
                    {group.last_message && <> · {group.last_message.substring(0, 30)}{group.last_message.length > 30 ? '...' : ''}</>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-xl">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Ainda não tens grupos</p>
            <p className="text-xs text-gray-400 mt-1">Cria um grupo para jogar com os teus amigos</p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Criar Grupo</h3>
                <button onClick={() => setShowCreateGroup(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do grupo *</label>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: Padel às quintas" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Descreve o grupo..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} maxLength={200} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto do grupo</label>
                <input type="file" accept="image/*" onChange={e => setNewGroupImage(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100">
              <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || creatingGroup} className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors">
                {creatingGroup ? 'A criar...' : 'Criar Grupo'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== FEED ==================== */}
      <div>
          {feedLoading ? (
            <div className="text-center py-12 text-gray-400">{t.common.loading}</div>
          ) : (
            <>
              {/* Sugestões de jogadores */}
              {suggestions.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">{t.learn.suggestedPlayers}</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {suggestions.map((player, idx) => {
                      const lvl = player.level
                      const colors = levelColors(player.level)
                      return (
                      <div key={`sug-${player.id}-${idx}`} className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpenPlayerProfile(player.user_id)}>
                        <div className="w-16 h-16 mx-auto rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-lg mb-2.5 overflow-hidden">
                          {player.avatar_url
                            ? <img src={player.avatar_url} className="w-full h-full object-cover" />
                            : getInitials(player.name)
                          }
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{player.name}</p>
                        {lvl && (
                          <span className={`inline-block mt-1.5 text-xl font-black px-3 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFollow(player.user_id) }}
                          className="mt-3 w-full py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          Seguir
                        </button>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Feed unificado (posts + jogos dos seguidos) */}
              {feedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">O teu feed está vazio</p>
                  <p className="text-sm text-gray-400 mt-1">Segue jogadores para ver as suas publicações e jogos aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedItems.map(item => {
                    if (item.type === 'post') {
                      const post = item.data as CommunityPost
                      return (
                        <div key={`post-${post.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          {/* Post header */}
                          <div className="flex items-center justify-between p-3 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                {post.author_avatar
                                  ? <img src={post.author_avatar} className="w-full h-full object-cover" />
                                  : getInitials(post.author_name)
                                }
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{post.author_name}</p>
                                <p className="text-[11px] text-gray-400">{timeAgo(post.created_at)}</p>
                              </div>
                            </div>
                            {post.user_id === userId && (
                              <button onClick={() => handleDeletePost(post.id)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {/* Post content */}
                          {post.content && (
                            <p className="px-3 pb-2 text-sm text-gray-700">{post.content}</p>
                          )}
                          {/* Post image */}
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="w-full max-h-80 object-cover" />
                          )}
                          {/* Post video */}
                          {post.video_url && (
                            <video src={post.video_url} controls className="w-full max-h-80" />
                          )}
                          {/* Post footer */}
                          <div className="px-3 py-2 border-t border-gray-50 flex items-center gap-4">
                            <button className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors">
                              <Heart className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    } else {
                      // Match card do jogador seguido – usa layout GameCardPlaytomic
                      const match = item.data as FeedMatchItem
                      // Converter FeedMatchItem para PlayerMatchForCard
                      const matchForCard: PlayerMatchForCard = {
                        id: match.id,
                        tournament_id: match.tournament_id,
                        tournament_name: match.tournament_name,
                        court: match.court,
                        start_time: match.start_time || match.played_at,
                        team1_name: match.team1_name,
                        team2_name: match.team2_name,
                        player1_name: match.player1_name,
                        player2_name: match.player2_name,
                        player3_name: match.player3_name,
                        player4_name: match.player4_name,
                        player1_avatar: match.player1_avatar,
                        player2_avatar: match.player2_avatar,
                        player3_avatar: match.player3_avatar,
                        player4_avatar: match.player4_avatar,
                        score1: match.score1,
                        score2: match.score2,
                        status: match.status,
                        round: match.round,
                        set1: match.set1,
                        set2: match.set2,
                        set3: match.set3,
                      }

                      return (
                        <div key={`match-${match.id}`} className="space-y-0">
                          {/* Header: quem jogou */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-50 to-white rounded-t-2xl border border-b-0 border-gray-100">
                            <div 
                              className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-[10px] overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handlePlayerClick(match.followed_player_name)}
                            >
                              {match.followed_player_avatar
                                ? <img src={match.followed_player_avatar} className="w-full h-full object-cover" />
                                : getInitials(match.followed_player_name)
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                <span 
                                  className="cursor-pointer hover:text-red-600 transition-colors"
                                  onClick={() => handlePlayerClick(match.followed_player_name)}
                                >
                                  {match.followed_player_name}
                                </span>
                                <span className={`ml-1.5 text-xs font-bold ${match.followed_player_won ? 'text-green-600' : 'text-red-500'}`}>
                                  {match.followed_player_won ? 'ganhou!' : 'perdeu'}
                                </span>
                              </p>
                              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                {match.tournament_name ? <><span>🏆</span> {match.tournament_name} · </> : null}
                                {timeAgo(match.played_at)}
                              </p>
                            </div>
                          </div>
                          {/* Card do jogo estilo Playtomic */}
                          <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
                            <GameCardPlaytomic 
                              match={matchForCard} 
                              fullWidth 
                              currentPlayerAvatar={playerAvatar}
                              currentPlayerName={playerName}
                              onPlayerClick={handlePlayerClick}
                            />
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )}
            </>
          )}

          {/* Floating + button */}
          <button
            onClick={() => setShowNewPost(true)}
            className="fixed bottom-20 right-4 w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-40"
          >
            <Plus className="w-7 h-7" />
          </button>

          {/* New Post Modal */}
          {showNewPost && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Nova Publicação</h3>
                  <button onClick={() => { setShowNewPost(false); setNewPostText(''); setNewPostImage(null); setNewPostVideo(null) }}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <textarea
                  value={newPostText}
                  onChange={e => setNewPostText(e.target.value)}
                  placeholder="O que queres partilhar?"
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <div className="flex items-center gap-3 mt-3">
                  <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer hover:text-red-600">
                    <Image className="w-5 h-5" />
                    <span>Foto</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewPostImage(e.target.files[0]); setNewPostVideo(null) } }} />
                  </label>
                  <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer hover:text-red-600">
                    <Video className="w-5 h-5" />
                    <span>Vídeo</span>
                    <input type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewPostVideo(e.target.files[0]); setNewPostImage(null) } }} />
                  </label>
                </div>
                {newPostImage && (
                  <div className="mt-2 relative">
                    <img src={URL.createObjectURL(newPostImage)} className="w-full h-40 object-cover rounded-lg" />
                    <button onClick={() => setNewPostImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {newPostVideo && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                    <Video className="w-4 h-4" />
                    <span className="truncate">{newPostVideo.name}</span>
                    <button onClick={() => setNewPostVideo(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <button
                  onClick={handleCreatePost}
                  disabled={postingLoading || (!newPostText.trim() && !newPostImage && !newPostVideo)}
                  className="mt-4 w-full py-2.5 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {postingLoading ? 'A publicar...' : <><Send className="w-4 h-4" /> Publicar</>}
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
