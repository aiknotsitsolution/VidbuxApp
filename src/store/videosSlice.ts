import { createSlice } from "@reduxjs/toolkit";
import { API_ORIGIN } from "../../config/api";

const resolveMediaUrl = (value: unknown) => {
  if (!value) return "";
  const normalized = String(value).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${API_ORIGIN}/${normalized.replace(/^\/+/, "")}`;
};

const normalizeShort = (video: Record<string, any>) => ({
  ...video,
  id: String(video._id || video.id),
  title: video.title || video.name || "Untitled Short",
  description: String(video.description || ""),
  videoUrl: resolveMediaUrl(video.videoUrl || video.video || video.url),
  thumbnail: resolveMediaUrl(video.thumbnail || video.thumb || video.poster),
  views: Number(video.views || video.viewCount) || 0,
  likes: Number(video.likesCount ?? video.likes) || 0,
  comments: Array.isArray(video.comments)
    ? video.comments.length
    : Number(video.comments) || 0,
  isLiked: video.userReaction === "like" || video.isLiked === true,
  isSubscribed: Boolean(video.isSubscribed),
  subscribersCount: Number(
    video.subscribersCount ?? video.channel?.subscribedBy?.length,
  ) || 0,
  channelOwnerId:
    video.channelOwnerId ||
    video.channel?.ownerId ||
    video.channel?.userId ||
    video.channel?.user?._id ||
    video.channel?.user?.id ||
    video.ownerId ||
    video.userId ||
    video.creatorId ||
    video.uploadedBy,
  raw: video,
});

const initialState = {
  profileVideos: [] as Record<string, any>[],
  profileVideosLoading: false,
  shorts: [] as Record<string, any>[],
  shortsHasMore: true,
  shortsPage: 0,
  cachedVideoData: {} as Record<string, any>,
};

const videosSlice = createSlice({
  name: "appVideos",
  initialState,
  reducers: {
    clearVideoData: (state) => {
      state.profileVideos = [];
      state.profileVideosLoading = false;
      state.shorts = [];
      state.shortsHasMore = true;
      state.shortsPage = 0;
      state.cachedVideoData = {};
    },
    setCachedVideoData: (state, action) => {
      state.cachedVideoData[action.payload.key] = action.payload.data;
    },
    setProfileVideosLoading: (state, action) => {
      state.profileVideosLoading = action.payload;
    },
    setProfileVideos: (state, action) => {
      state.profileVideos = action.payload;
    },
    addSelectedShort: (state, action) => {
      const selected = normalizeShort({
        ...(action.payload.raw || {}),
        ...action.payload,
      });
      state.shorts = [
        selected,
        ...state.shorts.filter((video) => video.id !== selected.id),
      ];
    },
    updateShortViews: (state, action) => {
      state.shorts = state.shorts.map((video) =>
        String(video.id) === String(action.payload.id)
          ? { ...video, views: Number(action.payload.views) || 0 }
          : video,
      );
    },
    incrementShortComments: (state, action) => {
      state.shorts = state.shorts.map((video) =>
        String(video.id) === String(action.payload)
          ? { ...video, comments: video.comments + 1 }
          : video,
      );
    },
    mergeShortsPage: (state, action) => {
      const { videos, page, reset, hasMore } = action.payload;
      const merged = new Map(
        (reset ? [] : state.shorts).map((video) => [video.id, video]),
      );
      videos.forEach((video: Record<string, any>) => {
        if (!merged.has(video.id)) merged.set(video.id, video);
      });
      state.shorts = Array.from(merged.values());
      state.shortsPage = page;
      state.shortsHasMore = hasMore;
    },
  },
});

export const {
  addSelectedShort,
  clearVideoData,
  incrementShortComments,
  mergeShortsPage,
  setProfileVideos,
  setProfileVideosLoading,
  setCachedVideoData,
  updateShortViews,
} = videosSlice.actions;
export default videosSlice.reducer;
