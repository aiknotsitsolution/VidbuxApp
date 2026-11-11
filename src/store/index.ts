import { configureStore } from "@reduxjs/toolkit";
import videosReducer, {
  addSelectedShort,
  mergeShortsPage,
  setCachedVideoData,
  setProfileVideos,
} from "./videosSlice";

export const store = configureStore({
  reducer: {
    appVideos: videosReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          addSelectedShort.type,
          mergeShortsPage.type,
          setCachedVideoData.type,
          setProfileVideos.type,
        ],
        ignoredPaths: ["appVideos"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
