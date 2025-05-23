# NuNxtWav-Dev SSO Backend

This is the backend service for NuNxtWav-Dev SSO using Azure AD authentication.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file with the following variables:
```
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
TENANT_ID=your_tenant_id
SESSION_SECRET=your_session_secret
CALLBACK_URL=http://localhost:3000/auth/callback
```

3. Run the development server:
```bash
npm run dev
```

## Deployment to Render.com

1. Create a new account on [Render.com](https://render.com)

2. Create a new Web Service:
   - Connect your GitHub repository
   - Select the repository
   - Choose "Node" as the runtime
   - Set the build command: `npm install`
   - Set the start command: `npm start`

3. Configure environment variables in Render:
   - `CLIENT_ID`: Your Azure AD client ID
   - `CLIENT_SECRET`: Your Azure AD client secret
   - `TENANT_ID`: Your Azure AD tenant ID
   - `SESSION_SECRET`: A secure random string
   - `CALLBACK_URL`: Your Render.com app URL + `/auth/callback`
   - `NODE_ENV`: Set to `production`

4. Update Azure AD App Registration:
   - Go to Azure Portal
   - Find your app registration
   - Add your Render.com callback URL to the allowed redirect URIs
   - Update the app registration with the new callback URL

## Important Notes

- Make sure to update the callback URL in Azure AD to match your deployed URL
- Keep your environment variables secure and never commit them to version control
- The free tier of Render.com will spin down after 15 minutes of inactivity
- Consider using a paid tier for production use 