# Comyata FileEngine

An engine to make data files computable! Simplify data lookup, dynamic configurations and more thanks to data templates with embedded logic.

Execute YAML and JSON files like programs and get clean data to work with as result.

Add custom adapters to support more file formats, connect with databases or to work with templates stored in databases or remote filesystems.

It's as easy (or complex) as:

```yaml
# run another template which knows how to get feedback data,
# filter its result and sort descending by date
feedback_from_london: ${ $import("./feedback-loader.yaml")[city = 'London']^(>feedback_date) }

# read a CSV and get all customers which are from London:
customers_in_london: ${ $load('./customers.csv')[city = 'London'] }

# use a JSONata function to connect with a database:
hits_count_from_london: ${ $sql('SELECT count(*) FROM hits where city = "London"') }
```

> Designed for JSONata, but not limited to any specific engine for producing dynamic output.

**🕹️ Examples:**

- FileEngine as API Server: [codesandbox](https://codesandbox.io/p/devbox/github/comyata/comyata/tree/main/server/fe) | [stackblitz](https://stackblitz.com/github/comyata/comyata/tree/main/server/fe) | [source in GitHub](https://github.com/comyata/comyata/tree/main/server/fe)

Learn more in the [GitHub README](https://github.com/comyata/comyata#setup-file-engine).

## License

This project is distributed as **free software** under the **MIT License**, see [License](https://github.com/comyata/comyata/blob/main/LICENSE).

© 2024 Michael Becker
