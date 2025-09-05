import YAML from 'yaml'
import { StepFlowConfig } from '../types/stepflow'
import { utf8, createZip, ZipFileEntry } from './zip'

export interface CodegenOptions {
  projectName: string
  basePackage: string
}

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function pkgToPath(pkg: string): string {
  return pkg.replace(/\./g, '/')
}

function javaTypeFor(value: any): string {
  if (typeof value === 'boolean') return 'Boolean'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'Integer' : 'Double'
  }
  if (Array.isArray(value)) return 'String' // represent as JSON string for simplicity
  if (typeof value === 'object' && value !== null) return 'String' // JSON string
  return 'String'
}

function fieldNameFor(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, ' ').split(' ').filter(Boolean).map((s, i) => i === 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

function capFirst(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

function collectGuardNames(cfg: StepFlowConfig): string[] {
  const names = new Set<string>()
  const steps = cfg.steps || {}
  Object.values(steps).forEach(step => {
    step.guards?.forEach(g => names.add(g))
    if (step.retry?.guard) names.add(step.retry.guard)
  })
  Object.values(cfg.workflows || {}).forEach(wf => {
    wf.edges.forEach(e => {
      if (e.guard) names.add(e.guard)
    })
  })
  return Array.from(names)
}

export function buildJavaZip(cfg: StepFlowConfig, opts: CodegenOptions): Blob {
  const files: ZipFileEntry[] = []
  const steps = Object.keys(cfg.steps || {})
  const guards = collectGuardNames(cfg)
  const basePkg = `${opts.basePackage}.generated`
  const base = `${opts.projectName}-java`
  const basePkgPath = pkgToPath(basePkg)

  // pom.xml (aligned with stepflow-codegen template)
  const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>${opts.basePackage}</groupId>
    <artifactId>${opts.projectName}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>
    <name>${opts.projectName}</name>
    <description>Generated StepFlow components from YAML configuration</description>
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <stepflow.version>0.2.0-SNAPSHOT</stepflow.version>
        <junit.version>5.10.0</junit.version>
        <slf4j.version>2.0.13</slf4j.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>com.stepflow</groupId>
            <artifactId>stepflow-core</artifactId>
            <version>${'${stepflow.version}'}</version>
        </dependency>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>${'${slf4j.version}'}</version>
        </dependency>
        <dependency>
            <groupId>ch.qos.logback</groupId>
            <artifactId>logback-classic</artifactId>
            <version>1.4.12</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${'${junit.version}'}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.1.2</version>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.4.1</version>
                <configuration>
                    <createDependencyReducedPom>false</createDependencyReducedPom>
                </configuration>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>`
  files.push({ path: `${base}/pom.xml`, content: utf8(pom) })

  // resources: bundle YAML as workflow.yaml
  const yaml = YAML.stringify(cfg, { indent: 2 })
  files.push({ path: `${base}/src/main/resources/workflow.yaml`, content: utf8(yaml) })

  // Main.java using SimpleEngine
  const defaultWorkflow = Object.keys(cfg.workflows || {})[0] || 'defaultFlow'
  const mainJava = `package ${basePkg};

import com.stepflow.core.SimpleEngine;
import com.stepflow.execution.ExecutionContext;

public class Main {
    public static void main(String[] args) {
        SimpleEngine engine = SimpleEngine.create("classpath:workflow.yaml", "${basePkg}");
        engine.execute("${defaultWorkflow}", new ExecutionContext());
    }
}
`
  files.push({ path: `${base}/src/main/java/${basePkgPath}/Main.java`, content: utf8(mainJava) })

  // Step classes
  steps.forEach(stepName => {
    const def = (cfg.steps || {})[stepName]
    const cls = `${toPascalCase(stepName)}Step`
    const packageName = `${basePkg}.steps`
    const configObj = def?.config || {}
    const hasConfig = Object.keys(configObj).length > 0
    const hasGuards = (def?.guards && def.guards.length > 0) ?? false

    let configFields = ''
    if (hasConfig) {
      for (const [key, value] of Object.entries(configObj)) {
        const type = javaTypeFor(value)
        const field = fieldNameFor(key)
        const cap = capFirst(field)
        configFields += `    @ConfigValue(value = "${key}")\n    private ${type} ${field};\n\n`
        configFields += `    public ${type} get${cap}() { return ${field}; }\n    public void set${cap}(${type} ${field}) { this.${field} = ${field}; }\n\n`
      }
    }

    const imports = [
      'import com.stepflow.execution.ExecutionContext;',
      'import com.stepflow.execution.Step;',
      'import com.stepflow.execution.StepResult;',
      'import com.stepflow.core.annotations.StepComponent;',
      hasConfig ? 'import com.stepflow.core.annotations.ConfigValue;' : '',
      hasGuards ? 'import com.stepflow.core.annotations.Inject;' : '',
      hasGuards ? 'import com.stepflow.execution.Guard;' : '',
      hasGuards ? 'import java.util.List;' : '',
      'import org.slf4j.Logger;',
      'import org.slf4j.LoggerFactory;',
    ].filter(Boolean).join('\n')

    const guardsBlock = hasGuards ? `\n    @Inject\n    private List<Guard> guards;\n` : ''
    const guardValidation = hasGuards ? `\n            if (guards != null && !guards.isEmpty()) {\n                for (Guard guard : guards) {\n                    if (!guard.evaluate(ctx)) {\n                        logger.warn("Guard failed for step: ${stepName}");\n                        return StepResult.failure("Guard validation failed");\n                    }\n                }\n            }\n` : ''

    const content = `package ${packageName};\n\n${imports}\n\n@StepComponent(name = "${stepName}")\npublic class ${cls} implements Step {\n\n    private static final Logger logger = LoggerFactory.getLogger(${cls}.class);\n\n${hasConfig ? configFields : ''}${guardsBlock}
    @Override\n    public StepResult execute(ExecutionContext ctx) {\n        logger.debug("Executing step: ${stepName}");\n        try {\n${guardValidation}\n            // TODO: Implement your business logic here\n            logger.info("Step ${stepName} executed successfully");\n            return StepResult.success(ctx);\n        } catch (Exception e) {\n            logger.error("Error executing step: ${stepName}", e);\n            return StepResult.failure("Execution error: " + e.getMessage());\n        }\n    }\n}\n`

    files.push({ path: `${base}/src/main/java/${basePkgPath}/steps/${cls}.java`, content: utf8(content) })
  })

  // Guard classes (unique)
  guards.forEach(guardName => {
    const cls = `${toPascalCase(guardName)}Guard`
    const packageName = `${basePkg}.guards`
    const imports = [
      'import com.stepflow.execution.ExecutionContext;',
      'import com.stepflow.execution.Guard;',
      'import com.stepflow.core.annotations.GuardComponent;',
      'import org.slf4j.Logger;',
      'import org.slf4j.LoggerFactory;',
    ].join('\n')
    const content = `package ${packageName};\n\n${imports}\n\n@GuardComponent(name = "${guardName}")\npublic class ${cls} implements Guard {\n\n    private static final Logger logger = LoggerFactory.getLogger(${cls}.class);\n\n    @Override\n    public boolean evaluate(ExecutionContext ctx) {\n        logger.debug("Evaluating guard: ${guardName}");\n        // TODO: Implement guard logic\n        return true;\n    }\n}\n`
    files.push({ path: `${base}/src/main/java/${basePkgPath}/guards/${cls}.java`, content: utf8(content) })
  })

  // README
  const readme = `# ${opts.projectName} (Java)\n\nGenerated from StepFlow Builder UI.\nThis layout follows stepflow-core conventions with annotations and a SimpleEngine Main.\n`
  files.push({ path: `${base}/README.md`, content: utf8(readme) })

  return createZip(files)
}
