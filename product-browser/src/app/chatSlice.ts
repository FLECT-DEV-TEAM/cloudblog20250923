import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { selectSessionId, setSessionId, clearSession } from "./sessionSlice";

// Customize to your backend
const INIT_HEADER = "x-init-token";
const SESSION_HEADER = "x-agentforce-session-id";
const SESSION_SEND_HEADER = "x-agentforce-session-id";

type RootState = {
  session: { id: string | null };
};

export const sendMessage = createAsyncThunk<void, string, { state: RootState }>(
  "chat/sendMessage",
  async (messageText, { dispatch, getState, signal }) => {
    // 1) Optimistically render the user message
    dispatch(chatSlice.actions.addUserMessage(messageText));

    // 2) Build headers
    const headers = new Headers({ "Content-Type": "application/json" });

    const sid = selectSessionId(getState() as any);
    if (!sid) {
      headers.set(INIT_HEADER, crypto.randomUUID());
    }
    else {
      headers.set(SESSION_SEND_HEADER, sid);
    }
    // 3) Send request (non-stream)
    const response = await fetch(`/services/apexrest/agentforce/send_and_reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: messageText }),
      signal,
    });

    // 4) Capture new/rotated session id
    const issued = response.headers.get(SESSION_HEADER);
    if (issued) {
      dispatch(setSessionId(issued));
    }

    if (!response.ok) {
      if (response.status === 401) dispatch(clearSession());
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // 5) Parse the whole response at once
    // Try JSON first, fall back to text
    let fullText = "";
    const raw = await response.text();

    try {
      const parsed = JSON.parse(raw);
      // Common shapes — adapt as needed
      // a) { message: "..." }
      if (typeof parsed?.message === "string") {
        fullText = parsed.message;
      }
      // // b) { data: { message: { type: "Text", message: "..." } } }
      // else if (parsed?.data?.message?.message) {
      //   fullText = String(parsed.data.message.message);
      // }
      // // c) { data: "..." }
      // else if (typeof parsed?.data === "string") {
      //   fullText = parsed.data;
      // }
      // // d) Unknown JSON shape → stringify safely
      // else {
      //   fullText = JSON.stringify(parsed);
      // }
    } catch {
      // Not JSON → treat as plain text
      fullText = raw;
    }

    // 6) Push one bot message (reuse existing placeholder + append)
    dispatch(chatSlice.actions.addBotMessagePlaceholder());
    if (fullText) {
      dispatch(chatSlice.actions.appendBotMessageChunk(fullText));
    }
  }
);

// ── your existing chatSlice below (unchanged) ──
type ChatMessage = {
  message: string;
  sentTime?: string;
  sender: "Einstein" | "You" | "System";
  direction: "incoming" | "outgoing";
  position: "single";
  type?: "custom";
};

type ChatState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  messages: ChatMessage[];
  error: string | null;
};

const initialState: ChatState = {
  status: "idle",
  messages: [
    {
      message: "こんにちは。何かお手伝いできることはありますか？",
      sentTime: "just now",
      sender: "Einstein",
      direction: "incoming",
      position: "single",
    },
  ],
  error: null,
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addUserMessage: (state, action: PayloadAction<string>) => {
      state.messages.push({
        message: action.payload,
        sender: "You",
        direction: "outgoing",
        position: "single",
      });
    },
    addBotMessagePlaceholder: (state) => {
      state.messages.push({
        message: "",
        sender: "Einstein",
        direction: "incoming",
        position: "single",
      });
    },
    appendBotMessageChunk: (state, action: PayloadAction<string>) => {
      const last = state.messages[state.messages.length - 1];
      if (last && last.direction === "incoming") {
        last.message += action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.status = "loading";
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Unknown error";
        state.messages.push({
          message: `Error: ${state.error}`,
          sender: "System",
          direction: "incoming",
          position: "single",
          type: "custom",
        });
      });
  },
});

export default chatSlice.reducer;