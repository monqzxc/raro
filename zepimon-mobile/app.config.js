export default ({ config }) => {
  const baseUrl = process.env.MONGAMES_EXPO_BASE_URL

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  }
}
