import { Box, useMediaQuery, useTheme } from '@mui/material';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  Avatar
} from '@chatscope/chat-ui-kit-react';
import { sendMessage } from '../../app/chatSlice';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../app/store'

type Props = {
  onClose?: () => void;
};

function cleanUri(uri: string): string {
  const prefix = "https://salesforce.rel/";
  if (uri.startsWith(prefix)) {
    return uri.slice(prefix.length);
  }
  return uri;
}

export default function ChatWidget({ onClose }: Props) {
  const theme = useTheme();
  const useAppDispatch = () => useDispatch<AppDispatch>()
  const dispatch = useAppDispatch()
  const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
  const small = useMediaQuery(theme.breakpoints.down('sm'));
  const { messages, status } = useAppSelector((state) => state.chat);

  const handleSend = (messageText: string) => {
    dispatch(sendMessage(messageText));
  };

  // Responsive sizing for the overlay window
  const width = small ? '100vw' : 420;
  const height = small ? '60vh' : 560;

  // @ts-expect-error: STATIC_ROOT is defined by Visusalforce page
  const staticRoot = window.STATIC_ROOT || ''; 
  const avatarPath = '/static/astro_chat_favicon.png'; // adjust path to match static resource structure
  const avatarSrc = staticRoot + avatarPath;

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 88, // keep above the FAB a bit
        width,
        height,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 6,
        overflow: 'hidden',
        zIndex: (t) => t.zIndex.modal + 1, // over MUI modals if needed
      }}
      role="dialog"
      aria-label="Chat support window"
    >
      <MainContainer>
        <ChatContainer>
          <MessageList
            typingIndicator={status === "loading" ? <TypingIndicator content="Agent is typing..." /> : null}
          >
            {messages.map((msg, id) => {
              // Decide what to render for the message body
              let body: React.ReactNode;
              //console.log("msg.message:" + msg.message);

              try {
                console.log("POS1");
                const o = JSON.parse(msg.message);
                //console.log("POS2 o:" + o);
                // @ts-expect-error: STATIC_ROOT is defined by Visusalforce page
                const staticRoot = window.STATIC_ROOT || '';
                //console.log("POS2.1");
                if (o && typeof o === "object") {
                  const imgPath = cleanUri(o.path);
                  console.log("POS2.2");
                  // body = (
                  //   <>
                  //     <Message.TextContent text={o.name} />
                  //     <Message.ImageContent src={`${staticRoot}${o.path}`} />
                  //     <Message.TextContent text={o.reason} />
                  //   </>
                  // );
                  body = 
                  <Message.CustomContent>
                    <div>
                      <div>{o.name} はいかがですか？</div>
                      <div><img src={`${staticRoot}/${imgPath}`} /></div>
                      <div>{o.reason}</div>
                    </div>
                  </Message.CustomContent>;
                } else {
                  //console.log("POS2.3");
                  body = <Message.TextContent text={msg.message} />;
                }
              } catch {
                console.log("POS3");
                // Not JSON → just render the raw text
                body = <Message.TextContent text={msg.message} />;
              }

              return (
                <Message key={id} model={{
                  direction: msg.direction,
                  position: msg.position
                }}>
                  {/* Avatar only for incoming */}
                  {msg.direction === "incoming" && (
                    <Avatar name="Agent" src={avatarSrc} />
                  )}
                  {body}
                </Message>
              );
            })}
          </MessageList>
          <MessageInput
            placeholder="Type your message..."
            attachButton={false}
            onSend={handleSend}
            onAttachClick={onClose}
          />
        </ChatContainer>
      </MainContainer>
    </Box>
  );
}