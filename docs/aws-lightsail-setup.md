# AWS Lightsail Setup Guide for LC Report App

This guide outlines the steps to set up an AWS Lightsail instance to host the LC Report application and work with the GitHub Actions CI/CD pipeline.

## Initial Lightsail Setup

1. **Create an AWS Lightsail instance**:
   - Go to the AWS Lightsail console
   - Create a new instance
   - Choose a Linux/Unix platform with Node.js blueprint
   - Select an appropriate instance plan (at least 2 GB RAM recommended)
   - Create and download the SSH key pair

2. **Update the instance**:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

3. **Install required packages**:
   ```bash
   # Install Node.js 18 (if not already available)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PM2 for process management
   sudo npm install -g pm2

   # Install Apache
   sudo apt install -y apache2
   ```

## Configure Apache and Node.js Integration

1. **Set up a reverse proxy with Apache**:
   ```bash
   # Enable required Apache modules
   sudo a2enmod proxy
   sudo a2enmod proxy_http
   sudo a2enmod rewrite
   sudo a2enmod headers
   ```

2. **Create a virtual host configuration**:
   ```bash
   sudo nano /etc/apache2/sites-available/lc-report.conf
   ```

   Add the following configuration:
   ```apache
   <VirtualHost *:80>
       ServerName your-domain-or-ip
       
       DocumentRoot /var/www/html/lc-report/public
       
       <Directory /var/www/html/lc-report/public>
           Options -Indexes +FollowSymLinks
           AllowOverride All
           Require all granted
       </Directory>

       # Proxy settings for Next.js
       ProxyPass /api http://localhost:3000/api
       ProxyPassReverse /api http://localhost:3000/api
       ProxyPass /_next http://localhost:3000/_next
       ProxyPassReverse /_next http://localhost:3000/_next
       ProxyPass / http://localhost:3000/
       ProxyPassReverse / http://localhost:3000/
       
       ErrorLog ${APACHE_LOG_DIR}/lc-report-error.log
       CustomLog ${APACHE_LOG_DIR}/lc-report-access.log combined
   </VirtualHost>
   ```

3. **Enable the virtual host and restart Apache**:
   ```bash
   sudo a2ensite lc-report.conf
   sudo systemctl restart apache2
   ```

## Set Up Deployment Directory

1. **Create the deployment directory**:
   ```bash
   sudo mkdir -p /var/www/html/lc-report
   sudo chown -R $USER:www-data /var/www/html/lc-report
   sudo chmod -R 775 /var/www/html/lc-report
   ```

## Configure PM2 for Process Management

1. **Create a PM2 ecosystem file**:
   ```bash
   nano /var/www/html/lc-report/ecosystem.config.js
   ```

   Add the following configuration:
   ```javascript
   module.exports = {
     apps: [
       {
         name: "lc-report",
         script: "npm",
         args: "start",
         cwd: "/var/www/html/lc-report",
         env: {
           NODE_ENV: "production",
           PORT: 3000
         },
         watch: false,
         max_memory_restart: "512M"
       }
     ]
   };
   ```

2. **Configure PM2 to start on boot**:
   ```bash
   pm2 startup
   # Run the command it outputs
   ```

## Set Up GitHub Secrets

Add the following secrets to your GitHub repository:

1. **SSH_PRIVATE_KEY**: Your private SSH key for the Lightsail instance
   - Copy the content of your downloaded `.pem` file 

2. **SSH_HOST**: Your Lightsail instance's public IP address or domain name

3. **SSH_USER**: The username for SSH (usually `ubuntu` or `bitnami` depending on your instance)

4. **KNOWN_HOSTS**: Generate the known_hosts content with this command:
   ```bash
   ssh-keyscan -H YOUR_LIGHTSAIL_IP_OR_DOMAIN
   ```
   - Copy the entire output into the secret

## Testing Your Setup

1. **Manual test**:
   ```bash
   # On your local machine
   cd /path/to/your/project
   npm run build
   tar -czf deployment.tar.gz .next public package.json package-lock.json next.config.js
   scp deployment.tar.gz USER@YOUR_LIGHTSAIL_IP:~/
   ```

2. **On the Lightsail instance**:
   ```bash
   tar -xzf deployment.tar.gz -C /var/www/html/lc-report
   cd /var/www/html/lc-report
   npm ci --omit=dev
   pm2 start ecosystem.config.js
   ```

3. **Check if your app is running**:
   ```bash
   pm2 status
   ```

4. **Access your application** in a browser by going to your Lightsail IP or domain.

## Troubleshooting

1. **Check Apache error logs**:
   ```bash
   sudo tail -f /var/log/apache2/lc-report-error.log
   ```

2. **Check PM2 logs**:
   ```bash
   pm2 logs lc-report
   ```

3. **If you need to restart the application**:
   ```bash
   pm2 restart lc-report
   ```

4. **If Apache isn't working**:
   ```bash
   sudo systemctl status apache2
   sudo systemctl restart apache2
   ``` 