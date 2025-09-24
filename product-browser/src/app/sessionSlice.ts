import type {PayloadAction} from "@reduxjs/toolkit"
import { createSlice } from '@reduxjs/toolkit';

type SessionState = { id: string | null };
const initialState: SessionState = { id: null };

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSessionId: (state, action: PayloadAction<string | null>) => {
      state.id = action.payload ?? null;
    },
    clearSession: (state) => {
      state.id = null;
    },
  },
});

export const { setSessionId, clearSession } = sessionSlice.actions;
export const selectSessionId = (state: { session: SessionState }) => state.session.id;
export default sessionSlice.reducer;