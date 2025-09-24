import { configureStore } from '@reduxjs/toolkit'
import { filesApi } from '../services/filesApiCf'
import chatReducer from './chatSlice'
import sessionReducer from './sessionSlice'

export const store = configureStore({
  reducer: {
    [filesApi.reducerPath]: filesApi.reducer,
    chat: chatReducer,
    session: sessionReducer,
  },
  middleware: (getDefault) => getDefault().concat(filesApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch