import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  Avatar
} from '@chatscope/chat-ui-kit-react';
import { sendMessage } from './store/chatSlice';

function Chat() {
  const dispatch = useDispatch();
  const { messages, status } = useSelector((state) => state.chat);

  const handleSend = (messageText) => {
    dispatch(sendMessage(messageText));
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <MainContainer responsive>
        <ChatContainer>
          <MessageList
            typingIndicator={status === 'loading' ? <TypingIndicator content="Agent is typing..." /> : null}
          >
            {messages.map((msg, i) => (
              <Message 
                key={i} 
                model={msg} 
              >
                {
                  msg.direction === 'incoming' && (
                    <Avatar 
                      src="/static/astro_chat_favicon.png" 
                      name="Agent" 
                    />
                  )
                }
              </Message>
            ))}
          </MessageList>
          <MessageInput
            placeholder="メッセージを入力してください"
            onSend={handleSend}
            disabled={status === 'loading'}
            attachButton={false} // Hiding the attachment button for simplicity
          />
        </ChatContainer>
      </MainContainer>
    </div>
  );
}

export default Chat;