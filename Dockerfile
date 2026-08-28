# ── Stage 1: Build React Frontend (Vite) ──
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Spring Boot JAR with embedded Frontend ──
FROM maven:3.9-eclipse-temurin-17 AS backend-builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B -P saas-prod
COPY src ./src
# Copy built React assets directly to Spring Boot static resources
COPY --from=frontend-builder /frontend/dist ./src/main/resources/static
RUN mvn clean package -DskipTests -P saas-prod

# ── Stage 3: Production Runtime ──
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root system user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built JAR from backend builder stage
COPY --from=backend-builder /app/target/cafe-mangment-system-0.0.1-SNAPSHOT.jar app.jar

# Set ownership to appuser
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Configure JVM flags for containerized environment
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
