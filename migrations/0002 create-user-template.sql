CREATE USER 'apidianuser'@'172.17.0.1' IDENTIFIED BY 'Admin@123';
-- Grant select privilege to all databases;
GRANT SELECT ON *.* TO 'apidianuser'@'172.17.0.1' WITH GRANT OPTION;
-- Grant all privileges to all databases;
GRANT ALL PRIVILEGES ON *.* TO 'apidianuser'@'172.17.0.1' WITH GRANT OPTION;

CREATE USER 'apidianuser'@'%' IDENTIFIED BY 'Admin@123';
-- Grant select privilege to all databases;
GRANT SELECT ON *.* TO 'apidianuser'@'%' WITH GRANT OPTION;
-- Grant all privileges to all databases;
GRANT ALL PRIVILEGES ON *.* TO 'apidianuser'@'%' WITH GRANT OPTION;
CREATE USER 'apidianuser'@'localhost' IDENTIFIED BY 'Admin@123';
-- Grant select privilege to all databases;
GRANT SELECT ON *.* TO 'apidianuser'@'localhost' WITH GRANT OPTION;
-- Grant all privileges to all databases;
GRANT ALL PRIVILEGES ON *.* TO 'apidianuser'@'localhost' WITH GRANT OPTION;