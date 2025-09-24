import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// The async thunk to handle the streaming API call
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (messageText, { dispatch }) => {
    // Add the user's message to the state immediately
    dispatch(chatSlice.actions.addUserMessage(messageText));

    // 受信待機デバッグ用
    // await new Promise(r => setTimeout(r, 1000 * 300));

    const response = await fetch(`/send_and_reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'message': messageText,
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    // Add a placeholder for the bot's response
    dispatch(chatSlice.actions.addBotMessagePlaceholder());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";  // holds any trailing partial line across chunks

    while (true) {
      try {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode incrementally; do NOT lose partial multibyte characters
        buffer += decoder.decode(value, { stream: true });

        // Split into lines; keep the last element as the (possibly) incomplete fragment
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue; // skip empty keep-alives

          try {
            const jsonData = JSON.parse(trimmed);
            const message = jsonData?.data?.message;
            if (message?.type !== "TextChunk") continue;

            dispatch(chatSlice.actions.appendBotMessageChunk(message.message));
          } catch (err) {
            // If a "complete" line can't be parsed, log and continue;
            // do not put it back into the buffer (it likely is malformed).
            console.warn("Skipping malformed JSON line:", trimmed.slice(0, 200), err);
          }
        }
      } catch (e) {
        console.error("Error reading/parsing stream chunk:", e);
        // optional: break or keep trying depending on your resilience strategy
      }
    } // end of while
    
    return; // Thunk completes successfully when the stream ends
  }
);


const initialState = {
  status: "idle", // "idle" | "loading" | "succeeded" | "failed"
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

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addUserMessage: (state, action) => {
      state.messages.push({
        message: action.payload,
        sender: "You",
        direction: "outgoing",
        position: "single"
      });
    },
    addBotMessagePlaceholder: (state) => {
        state.messages.push({
            message: "",
            sender: "Einstein",
            direction: "incoming",
            position: "single"
        });
    },
    appendBotMessageChunk: (state, action) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.direction === 'incoming') {
            lastMessage.message += action.payload;
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
        state.error = action.error.message;
        // Add an error message to the chat
         state.messages.push({
            message: `Error: ${action.error.message}`,
            sender: "System",
            direction: "incoming",
            position: "single",
            type: "custom" // Or handle this differently in the UI
        });
      });
  },
});

export default chatSlice.reducer;