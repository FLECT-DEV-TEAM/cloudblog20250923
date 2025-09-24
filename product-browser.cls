@RestResource(urlMapping='/agentforce/*')
global with sharing class AgentforceHandler {
    public static String MY_SESSION_ID_HEADER = 'x-init-token';
    public static String AF_SESSION_ID_HEADER = 'x-agentforce-session-id';
    
    global class AgentforceSessionRequest {
        public String externalSessionKey;
        public AgentforceInstanceConfig instanceConfig;
        public AgentforceStreamingCapabilities streamingCapabilities;
        public Boolean bypassUser;
        
        public AgentforceSessionRequest(String externalSessionKey, String endpoint) {
            this.externalSessionKey = externalSessionKey;
            this.instanceConfig = new AgentforceInstanceConfig(endpoint);
            this.streamingCapabilities = new AgentforceStreamingCapabilities();
            this.bypassUser = false;
        }
    }
    
    global class AgentforceInstanceConfig {
        public String endpoint;
        
        public AgentforceInstanceConfig(String endpoint) {
            this.endpoint = endpoint;
        }
    }
    
    global class AgentforceStreamingCapabilities {
        public List<String> chunkTypes;
        
        public AgentforceStreamingCapabilities() {
            this.chunkTypes = new List<String>{'Text'};
        }
    }

    global class AgentforceResponseMessage {
        public String type;
        public String message;
    }
    
    global class AgentforceSessionResponse {
        public String sessionId;
        public List<AgentforceResponseMessage> messages;
    }
    
    global class AgentforceMessageRequest {
        public AgentforceMessage message;
        
        public AgentforceMessageRequest(String text) {
            this.message = new AgentforceMessage(text);
        }
    }

    global class MyMessageRequest {
        public String message;
        public String agentforceSessionId;
    }

    global class ApiResponse {
        public String status;
        public String message;
        
        public ApiResponse(String status, String message) {
            this.status = status;
            this.message = message;
        }
    }
    
    global class AgentforceMessage {
        public Integer sequenceId;
        public String type;
        public String text;
        
        public AgentforceMessage(String text) {
            this.sequenceId = Integer.valueOf(Math.mod(System.now().getTime() / 1000, 2147483647));
            this.type = 'Text';
            this.text = text;
        }
    }
    
    global class AgentforceMessageResponse {
        public List<AgentforceResponseMessage> messages;
    }

    private static String createAgentforceSession(String mySessionId) {
        t219tecptl467__c config = t219tecptl467__c.getOrgDefaults();
        String agentId = config.AfAgentId__c;
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:t219tecptl467/einstein/ai-agent/v1/agents/' + agentId + '/sessions');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(10000);
        
        AgentforceSessionRequest payload = new AgentforceSessionRequest(
            mySessionId, 
            URL.getOrgDomainUrl().toExternalForm()
        );
        
        req.setBody(JSON.serialize(payload));
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() != 200) {
            throw new CalloutException('Failed to create Agentforce session: ' + res.getBody());
        }
        
        AgentforceSessionResponse response = (AgentforceSessionResponse) JSON.deserialize(
            res.getBody(), 
            AgentforceSessionResponse.class
        );
        
        return response.sessionId;
    } // end of createAgentforceSession

    private static String sendToAgentforce(String sessionId, String text) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:t219tecptl467/einstein/ai-agent/v1/sessions/' + sessionId + '/messages');
        req.setMethod('POST');
        req.setHeader('Accept', 'application/json');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(30000);
        
        AgentforceMessageRequest payload = new AgentforceMessageRequest(text);
        req.setBody(JSON.serialize(payload));
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() != 200) {
            throw new CalloutException('Failed to send message to Agentforce: ' + res.getBody());
        }
        
        AgentforceMessageResponse response = (AgentforceMessageResponse) JSON.deserialize(
            res.getBody(), 
            AgentforceMessageResponse.class
        );
        
        if (response.messages == null || response.messages.isEmpty()) {
            return '(No response)';
        }
        
        String responseText = response.messages[0].message;
        if (String.isBlank(responseText)) {
            return '(No message field)';
        }
        
        System.debug('>>> ' + text);
        System.debug('<<< ' + responseText);
        
        return responseText;
    } // end of sendToAgentforce

    private static ApiResponse handleSendAndReply(String message, String mySessionId, String agentforceSessionId) {
        // 1. Ensure Agentforce session
        if (agentforceSessionId == null) {
            String afSessionId = createAgentforceSession(mySessionId);
            String afReply = sendToAgentforce(afSessionId, message);
            ApiResponse res = new ApiResponse('success', afReply);
            RestContext.response.headers.put(AF_SESSION_ID_HEADER, afSessionId);
            return res;
        }
        String afReply = sendToAgentforce(agentforceSessionId, message);
        ApiResponse res = new ApiResponse('success', afReply);
        return res;
    } // end of handleSendAndReply

    @HttpPost
    global static ApiResponse handlePost() {
        RestRequest req = RestContext.request;
        String path = req.requestURI;
        String basePath = '/agentforce/';
        String action = path.replace(basePath, '').toLowerCase();
        String mySessionId = req.headers.get(MY_SESSION_ID_HEADER);
        String agentforceSessionId = req.headers.get(AF_SESSION_ID_HEADER);
        
        if (action == 'send_and_reply' && (mySessionId != null || agentforceSessionId != null)) {
            try {
                String body = req.requestBody.toString();
                MyMessageRequest myMessageRequest = (MyMessageRequest) JSON.deserialize(body, MyMessageRequest.class);
                return handleSendAndReply(myMessageRequest.message, mySessionId, agentforceSessionId);    
            }
            catch (Exception e) {
                RestContext.response.statusCode = 500;
                return new ApiResponse('exception', 'action' + action + 
                    ' mySessionId: ' + mySessionId +
                    ' agentforceSessionId: ' + agentforceSessionId +
                    ' exception: ' + e.getMessage() + 
                    ' stackTrace: ' + e.getStackTraceString()
                );
            }
        } else {
            RestContext.response.statusCode = 404;
            return new ApiResponse('error', 'Unsupported path: ' + action + ' mySessionId: ' + mySessionId + ' agentforceSessionId: ' + agentforceSessionId);
        }
    } // end of handlePost
}