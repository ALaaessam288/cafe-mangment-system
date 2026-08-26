# Multi-stage Dockerfile for Caffio Spring Boot SaaS Backend

# Build Stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml and download dependencies (saas-prod profile pulls in the
# PostgreSQL driver + Flyway, which are required at runtime on Railway)
COPY pom.xml .
RUN mvn dependency:go-offline -B -P saas-prod

# Copy source code and build production JAR
COPY src ./src
RUN mvn clean package -DskipTests -P saas-prod

# Runtime Stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root system user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built JAR from build stage
COPY --from=build /app/target/cafe-mangment-system-0.0.1-SNAPSHOT.jar app.jar

# Set ownership to appuser
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Configure JVM flags for containerized environment
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
